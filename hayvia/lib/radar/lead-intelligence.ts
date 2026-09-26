import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getListingType } from "@/data/properties";
import { getProperties } from "@/lib/properties-source";
import { getActiveMatchWeights } from "@/lib/matching/weights";
import { rankMatches } from "@/lib/matching/scoring";
import { leadRequirementsToMatchingPreferences } from "@/lib/radar/lead-matching-adapter";
import { extractLeadRequirements, InvalidLeadExtractionError } from "@/lib/radar/lead-extraction";
import type { LeadCategory, LeadRequirementExtraction, LeadQualification, PosterRole } from "@/lib/radar/lead-requirement-schema";

// -----------------------------------------------------------------------------
// PR #25 — the shared Lead Intelligence core. Extended by the Lead
// Qualification Gate (this change) to screen a raw signal BEFORE it becomes
// a retained radar_lead_candidates row, rather than always creating one and
// classifying afterward.
//
//   promoteRawLeadToCandidate(): radar_lead_raw row -> radar_lead_candidates
//     row (status DISCOVERED). No AI. Idempotent — a raw row that already
//     has a candidate returns the existing one rather than creating a
//     second. UNCHANGED by the gate — it's a pure primitive, now called
//     conditionally (only for QUALIFIED/NEEDS_REVIEW) instead of always.
//
//   classifyLeadCandidate(): an EXISTING candidate -> AI (re-)classification
//     -> radar_lead_analysis (versioned) -> denormalized candidate fields ->
//     (only if qualification is QUALIFIED) the EXISTING matching engine,
//     unmodified. Used by the detail page's "Run Lead Intelligence" button
//     and the PR #23 manual test page — both unchanged call sites.
//
//   screenAndProcessRawLeadSignal(): the NEW entry point for a raw signal
//     that has never been screened. ONE AI call (the same
//     extractLeadRequirements(), now extended with poster_role +
//     qualification) decides everything:
//       - DISCARD  -> writes radar_lead_screening ONLY. No candidate, no
//                     radar_lead_analysis. The AI is confident this is not a
//                     genuine seeker (SELLER/OWNER listing, AGENT inventory,
//                     ad, or NOISE).
//       - QUALIFIED / NEEDS_REVIEW -> promoteRawLeadToCandidate(), THEN the
//                     same persist-and-maybe-match logic classifyLeadCandidate()
//                     uses (shared via persistLeadClassification() below, so
//                     there is only ever one place that writes
//                     radar_lead_analysis + syncs the candidate's
//                     denormalized fields — the same non-divergence
//                     guarantee PR #25 established for lead_category, now
//                     extended to poster_role/qualification). Matching only
//                     runs for QUALIFIED — a NEEDS_REVIEW candidate is
//                     retained and visible in Admin, but never auto-matched
//                     or auto-alerted until a human approves it (a later PR).
//
// An AI-call failure (no OPENAI_API_KEY, network/rate-limit error, invalid
// response) is NEVER interpreted as a DISCARD verdict: no radar_lead_
// screening row is written in that case, so the raw row stays indistinguish-
// able from "never screened" and is retried by the next "Classify Pending"
// run — the same retryable-failure guarantee PR #27 established.
//
// Idempotency: radar_lead_screening has a unique index on raw_id — a raw
// row is screened AT MOST ONCE. screenAndProcessRawLeadSignal() checks for
// an existing screening row first and short-circuits without calling AI
// again if one exists, whatever its verdict (including DISCARD — a
// discarded raw row is never silently re-screened on every subsequent run).
// -----------------------------------------------------------------------------

export interface LeadMatchedProperty {
  propertyCode: string | null;
  title: string;
  price: number;
  location: string;
  overall: number;
  reasons: string[];
}

export interface PromoteRawLeadResult {
  candidateId: string;
  candidateCode: string;
  /** True when an existing candidate for this raw_id was found and reused instead of creating a new one. */
  alreadyPromoted: boolean;
}

/**
 * Creates a radar_lead_candidates row from an existing radar_lead_raw row
 * (no AI, status DISCOVERED) — or returns the existing candidate if this
 * raw row was already promoted. Reads the post text from
 * raw_payload.text, the convention both the manual test action and the
 * Apify adapter (lib/radar/apify-lead-adapter.ts) write to.
 *
 * UNCHANGED by the Lead Qualification Gate — still a pure "raw row ->
 * candidate row" primitive. The gate controls WHEN this is called (only for
 * QUALIFIED/NEEDS_REVIEW), not what it does.
 */
export async function promoteRawLeadToCandidate(
  supabase: SupabaseClient,
  rawId: string,
  adminId: string
): Promise<PromoteRawLeadResult | { error: string }> {
  const { data: existing } = await supabase
    .from("radar_lead_candidates")
    .select("id, candidate_code")
    .eq("raw_id", rawId)
    .maybeSingle();

  if (existing) {
    return { candidateId: existing.id as string, candidateCode: existing.candidate_code as string, alreadyPromoted: true };
  }

  const { data: raw, error: rawError } = await supabase
    .from("radar_lead_raw")
    .select("source_id, source_url, source_identifier, raw_payload")
    .eq("id", rawId)
    .maybeSingle();
  if (rawError || !raw) {
    return { error: rawError?.message || `Raw lead signal ${rawId} not found.` };
  }

  const text = (raw.raw_payload as Record<string, unknown> | null)?.text;
  if (typeof text !== "string" || !text.trim()) {
    return { error: `Raw lead signal ${rawId} has no "text" field in raw_payload to classify.` };
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("radar_lead_candidates")
    .insert({
      raw_id: rawId,
      source_id: raw.source_id,
      source_url: raw.source_url,
      source_identifier: raw.source_identifier,
      notes_from_source: text,
      status: "DISCOVERED",
    })
    .select("id, candidate_code")
    .single();
  if (candidateError || !candidate) {
    return { error: candidateError?.message || "Failed to create the Radar Lead candidate." };
  }

  const { error: historyError } = await supabase.from("radar_lead_status_history").insert({
    candidate_id: candidate.id,
    from_status: null,
    to_status: "DISCOVERED",
    changed_by: adminId,
  });
  if (historyError) {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Lead candidate ${candidate.candidate_code} created, but its initial status history row failed:`,
      historyError
    );
  }

  return { candidateId: candidate.id as string, candidateCode: candidate.candidate_code as string, alreadyPromoted: false };
}

export type LeadClassificationOutcome =
  | {
      ok: true;
      candidateId: string;
      candidateCode: string;
      extraction: LeadRequirementExtraction;
      limitations: string[];
      matches: LeadMatchedProperty[];
      totalCandidatePool: number;
    }
  | { ok: false; reason: "not_found" | "not_configured" | "extraction_failed" | "invalid_extraction" | "persist_failed"; error: string };

export type LeadScreeningOutcome =
  | { ok: true; outcome: "discarded"; posterRole: PosterRole; category: LeadCategory; confidence: number; reason: string }
  | { ok: true; outcome: "already_screened"; qualification: LeadQualification }
  | ({ ok: true; outcome: "qualified" | "needs_review" } & Extract<LeadClassificationOutcome, { ok: true }>)
  | { ok: false; reason: "not_found" | "not_configured" | "extraction_failed" | "invalid_extraction" | "persist_failed"; error: string };

// category -> purpose (listing_type_enum, RENT/BUY only). The ONLY place
// this mapping happens — lib/radar/lead-matching-adapter.ts (the existing,
// unmodified PR #23 adapter) still speaks purely in terms of `purpose`
// ("BUY"|"RENT"|null), exactly as it did before this PR. SELLER/NOISE map
// to null, which the adapter already treats as "matching cannot run".
function categoryToPurpose(category: LeadCategory): "BUY" | "RENT" | null {
  if (category === "BUYER") return "BUY";
  if (category === "RENTER") return "RENT";
  return null;
}

/**
 * The ONE place that writes radar_lead_analysis AND syncs
 * radar_lead_candidates' denormalized fields (lead_category, poster_role,
 * qualification, purpose, etc.) — always from the same validated extraction
 * result object, so they can never reflect two different classifications
 * for the same event. Shared by classifyLeadCandidate() (re-classifying an
 * EXISTING candidate) and screenAndProcessRawLeadSignal() (a brand-new raw
 * row that just got promoted) so there is exactly one implementation of
 * "persist a classification result", not two competing ones.
 *
 * Matching only runs when the EFFECTIVE qualification is QUALIFIED.
 *
 * Safety net: a DISCARD verdict can only reach this function when
 * re-classifying an ALREADY-EXISTING candidate (screenAndProcessRawLeadSignal()
 * never calls this for a DISCARD — see that function). An automated
 * re-classification is never allowed to make an already-retained candidate
 * disappear or drop below NEEDS_REVIEW; only an explicit human Reject
 * (a later PR) can close one out. So a DISCARD-on-existing is clamped to
 * NEEDS_REVIEW here, with the AI's DISCARD reasoning still persisted to
 * radar_lead_analysis and surfaced in `limitations` for a human to notice.
 */
async function persistLeadClassification(
  supabase: SupabaseClient,
  candidate: { id: string; candidateCode: string; status: string },
  adminId: string,
  result: LeadRequirementExtraction,
  modelName: string,
  modelVersion: string | null
): Promise<LeadClassificationOutcome> {
  const candidateId = candidate.id;

  // Next version for this candidate (plain select+insert, not an atomic
  // RPC like Property Radar's Phase 8D-3 — re-classification of the SAME
  // lead candidate by two admins at once is an edge case this foundation
  // doesn't need to guard against yet, consistent with PR #23's own
  // simplification for Lead Radar analysis).
  const { data: latestVersion } = await supabase
    .from("radar_lead_analysis")
    .select("version")
    .eq("candidate_id", candidateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((latestVersion?.version as number | undefined) ?? 0) + 1;

  const { error: analysisError } = await supabase.from("radar_lead_analysis").insert({
    candidate_id: candidateId,
    version: nextVersion,
    model_name: modelName,
    model_version: modelVersion,
    facts: {
      category: result.category,
      property_type: result.property_type,
      location: result.location,
      budget_min: result.budget_min,
      budget_max: result.budget_max,
      bedrooms_min: result.bedrooms_min,
      timeline: result.timeline,
    },
    ai_inference: {
      requirements: result.requirements,
      reason: result.reason,
      poster_role: result.poster_role,
      qualification: result.qualification,
    },
    unknowns: result.unknowns,
    intent_category: result.intent_category,
    intent_score: result.intent_score,
    confidence: result.confidence,
    evidence: { requirements: result.requirements },
  });
  if (analysisError) {
    // eslint-disable-next-line no-console
    console.error(`[Subphiphat Admin] Classification succeeded but failed to persist analysis for ${candidate.candidateCode}:`, analysisError);
    return { ok: false, reason: "persist_failed", error: "AI classification succeeded but saving the analysis failed." };
  }

  const isDiscardOnExisting = result.qualification === "DISCARD";
  const effectiveQualification: "QUALIFIED" | "NEEDS_REVIEW" =
    result.qualification === "QUALIFIED" ? "QUALIFIED" : "NEEDS_REVIEW";

  const purpose = categoryToPurpose(result.category);
  const candidateUpdate: Record<string, unknown> = {
    status: effectiveQualification,
    lead_category: result.category,
    poster_role: result.poster_role,
    qualification: effectiveQualification,
  };
  if (purpose) candidateUpdate.purpose = purpose;
  if (result.property_type !== "UNKNOWN") candidateUpdate.property_type = result.property_type;
  if (result.location.province) candidateUpdate.province = result.location.province;
  if (result.location.city) candidateUpdate.city = result.location.city;
  if (result.location.district) candidateUpdate.district = result.location.district;
  if (result.budget_min != null) candidateUpdate.budget_min = result.budget_min;
  if (result.budget_max != null) candidateUpdate.budget_max = result.budget_max;
  if (result.bedrooms_min != null) candidateUpdate.bedrooms = result.bedrooms_min;
  if (result.timeline) candidateUpdate.timeline = result.timeline;

  const { error: candidateUpdateError } = await supabase.from("radar_lead_candidates").update(candidateUpdate).eq("id", candidateId);

  if (!candidateUpdateError) {
    await supabase.from("radar_lead_status_history").insert({
      candidate_id: candidateId,
      from_status: candidate.status,
      to_status: effectiveQualification,
      changed_by: adminId,
      note: isDiscardOnExisting
        ? `AI re-classification suggested DISCARD (${result.reason}) — flagged NEEDS_REVIEW instead of auto-discarding an existing retained candidate; a human should review.`
        : `AI classification completed (${result.category}, ${effectiveQualification})`,
    });
  } else {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Analysis saved but syncing candidate ${candidate.candidateCode}'s denormalized fields failed:`,
      candidateUpdateError
    );
    return {
      ok: false,
      reason: "persist_failed",
      error: "AI classification and analysis were saved, but updating the candidate record failed — its denormalized fields may be stale.",
    };
  }

  let matches: LeadMatchedProperty[] = [];
  let limitations: string[] = [];
  let totalCandidatePool = 0;

  if (effectiveQualification === "QUALIFIED") {
    ({ matches, limitations, totalCandidatePool } = await matchLeadFacts(supabase, {
      purpose,
      propertyType: result.property_type === "UNKNOWN" ? null : result.property_type,
      city: result.location.city,
      district: result.location.district,
      budgetMin: result.budget_min,
      budgetMax: result.budget_max,
      bedroomsMin: result.bedrooms_min,
    }));
  } else {
    limitations = isDiscardOnExisting
      ? [`AI re-classification suggested DISCARD (${result.reason}) — matching deferred; a human should review this candidate.`]
      : ["Matching deferred until this NEEDS_REVIEW candidate is approved."];
  }

  return {
    ok: true,
    candidateId,
    candidateCode: candidate.candidateCode,
    extraction: result,
    limitations,
    matches,
    totalCandidatePool,
  };
}

/**
 * Runs AI (re-)classification for an EXISTING candidate. Never creates a
 * candidate — use promoteRawLeadToCandidate() (directly, or via
 * screenAndProcessRawLeadSignal() for a brand-new raw row) first. Used by
 * the detail page's "Run Lead Intelligence" button and the PR #23 manual
 * test page, both unchanged call sites — they pick up poster_role/
 * qualification and the matching-only-when-QUALIFIED gate automatically.
 */
export async function classifyLeadCandidate(
  supabase: SupabaseClient,
  candidateId: string,
  adminId: string
): Promise<LeadClassificationOutcome> {
  const { data: candidate, error: candidateFetchError } = await supabase
    .from("radar_lead_candidates")
    .select("id, candidate_code, status, notes_from_source")
    .eq("id", candidateId)
    .maybeSingle();
  if (candidateFetchError || !candidate) {
    return { ok: false, reason: "not_found", error: candidateFetchError?.message || "Lead candidate not found." };
  }

  const text = candidate.notes_from_source as string | null;
  if (!text || !text.trim()) {
    return { ok: false, reason: "not_found", error: `Candidate ${candidate.candidate_code} has no post text to classify.` };
  }

  let extraction;
  try {
    extraction = await extractLeadRequirements(text);
  } catch (err) {
    const invalid = err instanceof InvalidLeadExtractionError;
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Lead classification ${invalid ? "returned an invalid result" : "failed"} for candidate ${candidate.candidate_code}:`,
      err
    );
    return {
      ok: false,
      reason: invalid ? "invalid_extraction" : "extraction_failed",
      error: err instanceof Error ? err.message : "AI classification failed.",
    };
  }

  if (!extraction.configured) {
    return { ok: false, reason: "not_configured", error: "OPENAI_API_KEY is not configured — no classification was run." };
  }

  return persistLeadClassification(
    supabase,
    { id: candidate.id as string, candidateCode: candidate.candidate_code as string, status: candidate.status as string },
    adminId,
    extraction.extraction,
    extraction.modelName,
    extraction.modelVersion
  );
}

export interface LeadMatchResult {
  matches: LeadMatchedProperty[];
  limitations: string[];
  totalCandidatePool: number;
}

/**
 * Translates lead facts into the EXISTING matching engine's input shape and
 * runs it — no second matching implementation, no change to lib/matching/*
 * or lib/radar/lead-matching-adapter.ts. Only BUYER/RENTER (purpose
 * "BUY"/"RENT") ever reach rankMatches(); a null purpose (SELLER/NOISE, or
 * category not yet classified) is the adapter's existing "matching cannot
 * run" signal — no candidate is scored, nothing is fabricated.
 *
 * Exported (not just used inside classifyLeadCandidate()) so the lead
 * detail page can recompute the same matches live on every render — this
 * is a pure, deterministic, no-AI computation, so nothing needs to be
 * persisted or re-run through classification just to redisplay it.
 */
export async function matchLeadFacts(
  supabase: SupabaseClient,
  facts: {
    purpose: "BUY" | "RENT" | null;
    propertyType: string | null;
    city: string | null;
    district: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
    bedroomsMin: number | null;
  }
): Promise<LeadMatchResult> {
  const { criteria, limitations } = leadRequirementsToMatchingPreferences(facts);

  if (!criteria) {
    return { matches: [], limitations, totalCandidatePool: 0 };
  }

  const { properties } = await getProperties();
  const candidatePool = properties.filter((p) => getListingType(p) === criteria.purpose);

  const { weights } = await getActiveMatchWeights();
  const ranked = rankMatches(criteria, candidatePool, weights, 5);

  // Admin-only display enrichment: look up each match's real SP-######
  // property_code. public_properties (what getProperties() reads)
  // deliberately excludes property_code, so this reads the base table
  // directly — display only, never touches the matching engine.
  const supabaseIds = ranked.map((r) => r.property.supabaseId).filter((id): id is string => Boolean(id));
  const codeById = new Map<string, string>();
  if (supabaseIds.length > 0) {
    const { data: codeRows } = await supabase.from("properties").select("id, property_code").in("id", supabaseIds);
    for (const row of codeRows ?? []) codeById.set(row.id as string, row.property_code as string);
  }

  const matches: LeadMatchedProperty[] = ranked.map((r) => ({
    propertyCode: r.property.supabaseId ? codeById.get(r.property.supabaseId) ?? null : null,
    title: r.property.title,
    price: r.property.price,
    location: r.property.location,
    overall: r.overall,
    reasons: r.reasons,
  }));

  return { matches, limitations, totalCandidatePool: candidatePool.length };
}

/**
 * The Lead Qualification Gate's entry point for a raw signal that has never
 * been screened. Replaces the old runLeadIntelligenceForRaw() (renamed, not
 * aliased — its contract fundamentally changes: the old function always
 * created a candidate, this one may not). Called by classifyPendingLeads()
 * (app/admin/(dashboard)/radar/leads/import/actions.ts) for every raw row
 * that has no radar_lead_screening row yet.
 *
 * Idempotent by raw_id via radar_lead_screening's unique index — a raw row
 * already screened (whatever the verdict, including DISCARD) short-circuits
 * without a second AI call.
 */
export async function screenAndProcessRawLeadSignal(
  supabase: SupabaseClient,
  rawId: string,
  adminId: string
): Promise<LeadScreeningOutcome> {
  const { data: existingScreening } = await supabase
    .from("radar_lead_screening")
    .select("qualification")
    .eq("raw_id", rawId)
    .maybeSingle();
  if (existingScreening) {
    return { ok: true, outcome: "already_screened", qualification: existingScreening.qualification as LeadQualification };
  }

  const { data: raw, error: rawError } = await supabase
    .from("radar_lead_raw")
    .select("raw_payload")
    .eq("id", rawId)
    .maybeSingle();
  if (rawError || !raw) {
    return { ok: false, reason: "not_found", error: rawError?.message || `Raw lead signal ${rawId} not found.` };
  }

  const text = (raw.raw_payload as Record<string, unknown> | null)?.text;
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, reason: "not_found", error: `Raw lead signal ${rawId} has no "text" field in raw_payload to screen.` };
  }

  let extraction;
  try {
    extraction = await extractLeadRequirements(text);
  } catch (err) {
    const invalid = err instanceof InvalidLeadExtractionError;
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Lead Qualification Gate screening ${invalid ? "returned an invalid result" : "failed"} for raw signal ${rawId}:`,
      err
    );
    // No radar_lead_screening row is written here — an AI-call failure must
    // never be interpreted as a DISCARD verdict. This raw row stays
    // retryable on the next "Classify Pending" run.
    return {
      ok: false,
      reason: invalid ? "invalid_extraction" : "extraction_failed",
      error: err instanceof Error ? err.message : "AI screening failed.",
    };
  }

  if (!extraction.configured) {
    return { ok: false, reason: "not_configured", error: "OPENAI_API_KEY is not configured — no screening was run." };
  }

  const result = extraction.extraction;

  if (result.qualification === "DISCARD") {
    const { error: screeningError } = await supabase.from("radar_lead_screening").insert({
      raw_id: rawId,
      poster_role: result.poster_role,
      category: result.category,
      qualification: "DISCARD",
      confidence: result.confidence,
      reason: result.reason,
      model_name: extraction.modelName,
      model_version: extraction.modelVersion,
      candidate_id: null,
    });
    if (screeningError) {
      // eslint-disable-next-line no-console
      console.error(`[Subphiphat Admin] Screening verdict was DISCARD for raw signal ${rawId}, but saving the screening record failed:`, screeningError);
      return { ok: false, reason: "persist_failed", error: "Screening verdict was DISCARD, but saving the screening record failed." };
    }
    return {
      ok: true,
      outcome: "discarded",
      posterRole: result.poster_role,
      category: result.category,
      confidence: result.confidence,
      reason: result.reason,
    };
  }

  // QUALIFIED or NEEDS_REVIEW -> this raw signal becomes a retained candidate.
  const promoted = await promoteRawLeadToCandidate(supabase, rawId, adminId);
  if ("error" in promoted) {
    return { ok: false, reason: "persist_failed", error: promoted.error };
  }

  const { error: screeningError } = await supabase.from("radar_lead_screening").insert({
    raw_id: rawId,
    poster_role: result.poster_role,
    category: result.category,
    qualification: result.qualification,
    confidence: result.confidence,
    reason: result.reason,
    model_name: extraction.modelName,
    model_version: extraction.modelVersion,
    candidate_id: promoted.candidateId,
  });
  if (screeningError) {
    // Not fatal to the pipeline — the candidate + analysis below remain the
    // source of truth. Without this row, this raw row would look
    // "unscreened" again next run and get re-screened, but
    // promoteRawLeadToCandidate() is idempotent so that would just reuse
    // the existing candidate rather than duplicate anything. Logged, not
    // returned as a failure.
    // eslint-disable-next-line no-console
    console.error(`[Subphiphat Admin] Candidate ${promoted.candidateCode} created, but saving its screening record failed:`, screeningError);
  }

  const outcome = await persistLeadClassification(
    supabase,
    { id: promoted.candidateId, candidateCode: promoted.candidateCode, status: "DISCOVERED" },
    adminId,
    result,
    extraction.modelName,
    extraction.modelVersion
  );

  if (!outcome.ok) return outcome;
  return {
    ok: true,
    outcome: result.qualification === "QUALIFIED" ? "qualified" : "needs_review",
    candidateId: outcome.candidateId,
    candidateCode: outcome.candidateCode,
    extraction: outcome.extraction,
    limitations: outcome.limitations,
    matches: outcome.matches,
    totalCandidatePool: outcome.totalCandidatePool,
  };
}
