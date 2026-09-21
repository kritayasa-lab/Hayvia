"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateManualSource } from "@/lib/radar/sources";
import { findPossibleDuplicateCandidates, type PossibleDuplicateCandidate } from "@/lib/radar/dedup";
import {
  runPropertyAiAnalysis,
  isValidConfiguredResult,
  InvalidAiOutputError,
  type PropertyAiAnalysisResult,
} from "@/lib/radar/ai-analysis";

export interface RadarCandidateActionState {
  error?: string;
  duplicates?: PossibleDuplicateCandidate[];
  rawId?: string;
}

function requireString(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

function optionalString(formData: FormData, key: string): string | null {
  const value = requireString(formData, key);
  return value || null;
}

function optionalNumber(formData: FormData, key: string): number | null {
  const value = requireString(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Manual Property Radar intake. Never spreads formData/request bodies into
 * an insert — every field written is explicitly named below.
 *
 * Two-step by design: a first submission creates the raw evidence record
 * and, if a rule-based duplicate is found, returns it to the UI instead of
 * silently creating a second candidate (see lib/radar/dedup.ts). The form
 * re-submits with the same `raw_id` (so evidence is never duplicated) and
 * `force_create=1` (the "Create Anyway" button) to proceed past the
 * duplicate warning — an explicit human decision, never automatic.
 */
export async function createManualCandidate(
  _prevState: RadarCandidateActionState | null,
  formData: FormData
): Promise<RadarCandidateActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const propertyType = requireString(formData, "property_type");
  const city = requireString(formData, "city");
  const description = requireString(formData, "description");
  if (!propertyType) return { error: "Please choose a property type." };
  if (!city) return { error: "Please enter a city." };
  if (!description) return { error: "Please enter a description." };

  const sourceUrl = optionalString(formData, "source_url");
  const sourceIdentifier = optionalString(formData, "source_identifier");
  const province = optionalString(formData, "province") ?? "Songkhla";
  const district = optionalString(formData, "district");
  const price = optionalNumber(formData, "price");
  const bedrooms = optionalNumber(formData, "bedrooms");
  const bathrooms = optionalNumber(formData, "bathrooms");
  const sizeSqm = optionalNumber(formData, "size_sqm");
  const evidenceNotes = optionalString(formData, "evidence_notes");
  const forceCreate = formData.get("force_create") === "1";

  const supabase = createAdminClient();

  let sourceId: string;
  try {
    sourceId = await findOrCreateManualSource(supabase);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to resolve the Manual Entry source." };
  }

  let rawId = optionalString(formData, "raw_id");
  if (!rawId) {
    const { data: raw, error: rawError } = await supabase
      .from("radar_property_raw")
      .insert({
        source_id: sourceId,
        source_url: sourceUrl,
        source_identifier: sourceIdentifier,
        // Preserves exactly what was submitted, including the free-text
        // evidence notes — the normalized candidate row below is built from
        // the same values, but this is the untouched evidence record.
        raw_payload: {
          propertyType,
          province,
          city,
          district,
          price,
          bedrooms,
          bathrooms,
          sizeSqm,
          description,
          evidenceNotes,
          submittedBy: admin.id,
        },
      })
      .select("id")
      .single();

    if (rawError || !raw) {
      return { error: rawError?.message || "Failed to save the raw record." };
    }
    rawId = raw.id as string;
  }

  if (!forceCreate) {
    const duplicates = await findPossibleDuplicateCandidates(supabase, {
      district,
      propertyType,
      bedrooms,
      price,
    });
    if (duplicates.length > 0) {
      return { duplicates, rawId };
    }
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("radar_property_candidates")
    .insert({
      raw_id: rawId,
      source_id: sourceId,
      source_url: sourceUrl,
      source_identifier: sourceIdentifier,
      property_type: propertyType,
      province,
      city,
      district,
      price,
      bedrooms,
      bathrooms,
      size_sqm: sizeSqm,
      description,
      status: "DISCOVERED",
    })
    .select("id")
    .single();

  if (candidateError || !candidate) {
    return { error: candidateError?.message || "Failed to create the Radar candidate." };
  }

  const { error: historyError } = await supabase.from("radar_property_status_history").insert({
    candidate_id: candidate.id,
    from_status: null,
    to_status: "DISCOVERED",
    changed_by: admin.id,
  });
  if (historyError) {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Radar candidate ${candidate.id} created, but its initial status history row failed:`,
      historyError
    );
  }

  // A new row changes what the list and overview pages show — revalidate
  // both so a browser tab already sitting on either doesn't keep serving a
  // stale (pre-creation) Router Cache entry on its next visit. The new
  // candidate's own detail page needs no revalidation: it didn't exist
  // before, so redirect() below renders it fresh with nothing stale to beat.
  revalidatePath("/admin/radar/properties");
  revalidatePath("/admin/radar");

  redirect(`/admin/radar/properties/${candidate.id}?created=1`);
}

/**
 * Explicit human confirmation that `candidateId` duplicates an existing
 * candidate, identified by its human-readable code (friendlier to type than
 * a UUID). Never deletes either candidate — only links and closes the one
 * being marked.
 */
export async function markDuplicate(candidateId: string, formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const duplicateOfCode = requireString(formData, "duplicate_of_code");
  if (!duplicateOfCode) {
    redirect(`/admin/radar/properties/${candidateId}?dupError=missing`);
  }

  const supabase = createAdminClient();

  const [{ data: candidate }, { data: target }] = await Promise.all([
    supabase.from("radar_property_candidates").select("id, status").eq("id", candidateId).maybeSingle(),
    supabase
      .from("radar_property_candidates")
      .select("id, candidate_code")
      .ilike("candidate_code", duplicateOfCode)
      .maybeSingle(),
  ]);

  if (!candidate) redirect("/admin/radar/properties");
  if (!target) redirect(`/admin/radar/properties/${candidateId}?dupError=notfound`);
  if (target.id === candidateId) redirect(`/admin/radar/properties/${candidateId}?dupError=self`);

  const { error } = await supabase
    .from("radar_property_candidates")
    .update({
      status: "DUPLICATE",
      duplicate_of_candidate_id: target.id,
      duplicate_confidence: 100,
    })
    .eq("id", candidateId);

  if (!error) {
    await supabase.from("radar_property_status_history").insert({
      candidate_id: candidateId,
      from_status: candidate.status,
      to_status: "DUPLICATE",
      changed_by: admin.id,
      note: `Marked duplicate of ${target.candidate_code}`,
    });

    // Revalidate every route whose rendered data depends on this status
    // change — the redirect below already forces a fresh render of this
    // candidate's own page, but the list/overview pages (and any other tab
    // already sitting on this exact candidate page) would otherwise keep
    // serving the pre-DUPLICATE Router Cache entry until it expires.
    revalidatePath(`/admin/radar/properties/${candidateId}`);
    revalidatePath("/admin/radar/properties");
    revalidatePath("/admin/radar");
  }

  redirect(`/admin/radar/properties/${candidateId}`);
}

/**
 * Runs AI analysis for a candidate via the configured provider (see
 * lib/radar/ai-analysis.ts — runPropertyAiAnalysis() returns
 * `configured: false` when no provider is set up, e.g. no ANTHROPIC_API_KEY
 * in this deployment). Never inserts a radar_property_analysis row unless
 * the result is both `configured: true` and passes isValidConfiguredResult().
 * A provider call that throws (network/auth/rate limit) or returns output
 * that fails structured validation never reaches the database — the
 * candidate is left exactly as it was, and the admin sees a specific error
 * state for each case (not configured / analysis failed / invalid result).
 */
export async function runAiAnalysisAction(candidateId: string) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  const { data: candidate } = await supabase
    .from("radar_property_candidates")
    .select(
      "id, status, raw_id, property_type, province, city, district, price, bedrooms, bathrooms, size_sqm, description"
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate) redirect("/admin/radar/properties");

  let rawPayload: unknown = null;
  if (candidate.raw_id) {
    const { data: raw } = await supabase
      .from("radar_property_raw")
      .select("raw_payload")
      .eq("id", candidate.raw_id)
      .maybeSingle();
    rawPayload = raw?.raw_payload ?? null;
  }

  let result: PropertyAiAnalysisResult;
  try {
    result = await runPropertyAiAnalysis({
      candidateId,
      facts: {
        propertyType: candidate.property_type,
        province: candidate.province,
        city: candidate.city,
        district: candidate.district,
        price: candidate.price,
        bedrooms: candidate.bedrooms,
        bathrooms: candidate.bathrooms,
        sizeSqm: candidate.size_sqm,
        description: candidate.description,
      },
      rawPayload,
    });
  } catch (err) {
    // Two distinct failure modes: the provider responded but its output
    // failed structured validation (InvalidAiOutputError, thrown by
    // lib/radar/ai-analysis.ts), vs. the call itself never completed
    // (network/auth/rate limit — an Anthropic SDK error or anything else).
    // Either way, nothing is persisted and the candidate is untouched.
    if (err instanceof InvalidAiOutputError) {
      // eslint-disable-next-line no-console
      console.error(`[Subphiphat Admin] AI analysis for candidate ${candidateId} returned invalid output:`, err.message);
      redirect(`/admin/radar/properties/${candidateId}?aiStatus=invalid`);
    }
    // eslint-disable-next-line no-console
    console.error(`[Subphiphat Admin] AI analysis for candidate ${candidateId} failed:`, err);
    redirect(`/admin/radar/properties/${candidateId}?aiStatus=failed`);
  }

  if (!result.configured) {
    redirect(`/admin/radar/properties/${candidateId}?aiStatus=not_configured`);
  }

  // Malformed provider response: validate before persistence, reject rather
  // than best-effort-repair. Nothing is written and the candidate is left
  // exactly as it was — a bad/partial AI result must never become stored
  // data. Re-checked here even though the Claude provider already validates
  // via Zod (lib/radar/ai-analysis.ts) — never trust a single validation
  // layer for a database write, and a future provider might not validate as
  // strictly.
  if (!isValidConfiguredResult(result)) {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] AI analysis for candidate ${candidateId} returned a malformed result — rejected, nothing persisted.`
    );
    redirect(`/admin/radar/properties/${candidateId}?aiStatus=invalid`);
  }

  // poster/acquisition are classifications (inferences), not literal
  // extracted facts — nested inside ai_inference alongside any other
  // inference the model returns, keeping `facts` strictly limited to
  // PropertyFacts. radar_property_analysis has no dedicated poster/
  // acquisition columns by design (Phase 8D-1/8D-2) — the full,
  // evidenced classification lives here; radar_property_candidates only
  // gets the denormalized `.value` for list filtering (synced below).
  //
  // Phase 8D-3 — version allocation moved into a single atomic RPC
  // (insert_radar_property_analysis, see the migration of the same phase)
  // instead of a separate `select count(*)` + `insert`, which raced under
  // concurrent analysis requests for the same candidate: two callers could
  // read the same count and both try to insert the same version. The RPC
  // locks the candidate row for the duration of its transaction, so a
  // concurrent second call simply waits and then correctly computes the
  // next version after the first commits.
  const { data: analysisRow, error: analysisError } = await supabase.rpc("insert_radar_property_analysis", {
    p_candidate_id: candidateId,
    p_model_name: result.modelName ?? null,
    p_model_version: result.modelVersion ?? null,
    p_facts: result.facts,
    p_ai_inference: { ...(result.aiInference ?? {}), poster: result.poster, acquisition: result.acquisition },
    p_unknowns: result.unknowns,
    p_confidence: result.confidence,
    p_evidence: result.evidence,
  });

  if (analysisError || !analysisRow) {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] AI analysis for candidate ${candidateId} passed validation but failed to persist:`,
      analysisError
    );
    redirect(`/admin/radar/properties/${candidateId}?aiStatus=failed`);
  }

  // Sync the denormalized query-convenience fields on the candidate from
  // this (now latest) analysis — independent of the status transition
  // below, since a re-analysis of a candidate already past DISCOVERED
  // should still update these.
  const candidateUpdate: Record<string, unknown> = {
    poster_type: result.poster.value,
    acquisition_type: result.acquisition.value,
  };
  if (candidate.status === "DISCOVERED") {
    candidateUpdate.status = "AI_REVIEWED";
  }

  const { error: candidateUpdateError } = await supabase
    .from("radar_property_candidates")
    .update(candidateUpdate)
    .eq("id", candidateId);

  if (!candidateUpdateError && candidate.status === "DISCOVERED") {
    await supabase.from("radar_property_status_history").insert({
      candidate_id: candidateId,
      from_status: "DISCOVERED",
      to_status: "AI_REVIEWED",
      changed_by: admin.id,
      note: "AI analysis completed",
    });
  }

  redirect(`/admin/radar/properties/${candidateId}?aiStatus=analyzed`);
}
