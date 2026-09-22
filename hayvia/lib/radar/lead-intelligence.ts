import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getListingType } from "@/data/properties";
import { getProperties } from "@/lib/properties-source";
import { getActiveMatchWeights } from "@/lib/matching/weights";
import { rankMatches } from "@/lib/matching/scoring";
import { leadRequirementsToMatchingPreferences } from "@/lib/radar/lead-matching-adapter";
import { extractLeadRequirements, InvalidLeadExtractionError } from "@/lib/radar/lead-extraction";
import type { LeadCategory, LeadRequirementExtraction } from "@/lib/radar/lead-requirement-schema";

// -----------------------------------------------------------------------------
// PR #25 — the shared Lead Intelligence core. Two stages, kept as two
// functions on purpose (mirrors PR #24's own "ingestion and intelligence are
// separate stages" principle, now applied one level deeper):
//
//   promoteRawLeadToCandidate(): radar_lead_raw row -> radar_lead_candidates
//     row (status DISCOVERED). No AI. Idempotent — a raw row that already
//     has a candidate returns the existing one rather than creating a
//     second.
//
//   classifyLeadCandidate(): an existing candidate -> AI classification
//     (lib/radar/lead-extraction.ts) -> radar_lead_analysis (versioned) ->
//     denormalized lead_category/purpose/etc. on the candidate -> (if
//     category is BUYER/RENTER) the EXISTING matching engine, unmodified.
//
// runLeadIntelligenceForRaw() below is just those two in sequence, for
// callers that have a raw_id and want the full pipeline in one call (the
// Apify import's "classify pending" action). A caller with an existing
// candidate_id (the detail page's "Run Lead Intelligence" button, a
// re-classification) calls classifyLeadCandidate() directly.
//
// This is the ONLY place that writes radar_lead_analysis AND
// radar_lead_candidates.lead_category — always in the same function
// invocation, both read from the exact same validated extraction result
// object, so the two can never reflect two different classifications for
// the same event (requirement: they must not silently diverge).
//
// Extracted from PR #23's original app/admin/(dashboard)/radar/leads/test/
// actions.ts, which is refactored to call this module instead of
// duplicating this logic — see that file's own comment.
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
 * Runs AI classification for an EXISTING candidate, persists the versioned
 * analysis + denormalized candidate fields (never diverging from each
 * other — see this file's header comment), and — only for BUYER/RENTER —
 * runs the existing matching engine. Never creates a candidate; use
 * promoteRawLeadToCandidate() first if needed.
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

  const result = extraction.extraction;

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

  // Both this insert and the candidate update below are derived from the
  // exact same `result` object — the one place lead_category and
  // radar_lead_analysis are written, so they cannot reflect two different
  // classifications for the same event.
  const { error: analysisError } = await supabase.from("radar_lead_analysis").insert({
    candidate_id: candidateId,
    version: nextVersion,
    model_name: extraction.modelName,
    model_version: extraction.modelVersion,
    facts: {
      category: result.category,
      property_type: result.property_type,
      location: result.location,
      budget_min: result.budget_min,
      budget_max: result.budget_max,
      bedrooms_min: result.bedrooms_min,
      timeline: result.timeline,
    },
    ai_inference: { requirements: result.requirements, reason: result.reason },
    unknowns: result.unknowns,
    intent_category: result.intent_category,
    intent_score: result.intent_score,
    confidence: result.confidence,
    evidence: { requirements: result.requirements },
  });
  if (analysisError) {
    // eslint-disable-next-line no-console
    console.error(`[Subphiphat Admin] Classification succeeded but failed to persist analysis for ${candidate.candidate_code}:`, analysisError);
    return { ok: false, reason: "persist_failed", error: "AI classification succeeded but saving the analysis failed." };
  }

  const purpose = categoryToPurpose(result.category);
  const candidateUpdate: Record<string, unknown> = {
    status: "AI_REVIEWED",
    lead_category: result.category,
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
      to_status: "AI_REVIEWED",
      changed_by: adminId,
      note: `AI classification completed (${result.category})`,
    });
  } else {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Analysis saved but syncing candidate ${candidate.candidate_code}'s denormalized fields (incl. lead_category) failed:`,
      candidateUpdateError
    );
    return {
      ok: false,
      reason: "persist_failed",
      error: "AI classification and analysis were saved, but updating the candidate record failed — lead_category may be stale.",
    };
  }

  const { matches, limitations, totalCandidatePool } = await matchLeadFacts(supabase, {
    purpose,
    propertyType: result.property_type === "UNKNOWN" ? null : result.property_type,
    city: result.location.city,
    district: result.location.district,
    budgetMin: result.budget_min,
    budgetMax: result.budget_max,
    bedroomsMin: result.bedrooms_min,
  });

  return {
    ok: true,
    candidateId,
    candidateCode: candidate.candidate_code as string,
    extraction: result,
    limitations,
    matches,
    totalCandidatePool,
  };
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
 * Convenience wrapper for callers that have a raw_id and want the full
 * ingestion-to-classification pipeline in one call (the Apify import's
 * batch "classify pending" action). A caller that already has a
 * candidate_id (a re-classification from the detail page) should call
 * classifyLeadCandidate() directly instead.
 */
export async function runLeadIntelligenceForRaw(
  supabase: SupabaseClient,
  rawId: string,
  adminId: string
): Promise<LeadClassificationOutcome> {
  const promoted = await promoteRawLeadToCandidate(supabase, rawId, adminId);
  if ("error" in promoted) {
    return { ok: false, reason: "not_found", error: promoted.error };
  }
  return classifyLeadCandidate(supabase, promoted.candidateId, adminId);
}
