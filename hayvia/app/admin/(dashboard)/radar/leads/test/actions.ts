"use server";

import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateManualSource } from "@/lib/radar/sources";
import { extractLeadRequirements, InvalidLeadExtractionError } from "@/lib/radar/lead-extraction";
import { leadRequirementsToMatchingPreferences } from "@/lib/radar/lead-matching-adapter";
import { getProperties } from "@/lib/properties-source";
import { getActiveMatchWeights } from "@/lib/matching/weights";
import { rankMatches } from "@/lib/matching/scoring";
import { getListingType } from "@/data/properties";
import type { LeadRequirementExtraction } from "@/lib/radar/lead-requirement-schema";

// -----------------------------------------------------------------------------
// Phase 8D — Lead Intelligence Foundation. Manual proof-of-flow action:
//
//   raw post -> radar_lead_raw/radar_lead_candidates (staging, exactly like
//   Property Radar's manual intake) -> AI extraction (lib/radar/lead-extraction.ts)
//   -> radar_lead_analysis (versioned, same shape Property Radar already
//   established) -> denormalized onto the candidate -> translated
//   (lib/radar/lead-matching-adapter.ts) -> the EXISTING matching engine
//   (lib/matching/scoring.ts's rankMatches(), unmodified).
//
// Deliberately does NOT call lib/matching/persist.ts — that writes a public
// "Get Matched" session (matching_preferences requires a user_id/session_id
// this internal admin flow has neither of, and would misrepresent a staff
// test click as a real visitor session). Match results here are computed
// and returned directly to the admin, never stored as a matching run.
//
// Also deliberately does NOT create a customers/leads/inquiries/viewings
// row — the result stays Radar intelligence. Nothing here auto-converts a
// Lead Radar candidate into a real CRM lead; that remains a future,
// explicit human-approval action, exactly like Property Radar's own
// candidate -> property conversion.
// -----------------------------------------------------------------------------

const MIN_POST_LENGTH = 5;
const MAX_POST_LENGTH = 4000;

export interface LeadMatchedProperty {
  propertyCode: string | null;
  title: string;
  price: number;
  location: string;
  overall: number;
  reasons: string[];
}

export interface LeadExtractionTestState {
  error?: string;
  result?: {
    candidateId: string;
    candidateCode: string;
    extraction: LeadRequirementExtraction;
    limitations: string[];
    matches: LeadMatchedProperty[];
    totalCandidatePool: number;
  };
}

export async function runLeadExtractionTest(
  _prevState: LeadExtractionTestState | null,
  formData: FormData
): Promise<LeadExtractionTestState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const rawPostText = String(formData.get("raw_post") || "").trim();
  if (!rawPostText) return { error: "Please paste a raw post to test." };
  if (rawPostText.length < MIN_POST_LENGTH) {
    return { error: "This post is too short to extract anything meaningful from." };
  }
  if (rawPostText.length > MAX_POST_LENGTH) {
    return { error: `Please keep the post under ${MAX_POST_LENGTH} characters.` };
  }

  const supabase = createAdminClient();

  let sourceId: string;
  try {
    sourceId = await findOrCreateManualSource(supabase);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to resolve the Manual Entry source." };
  }

  const { data: raw, error: rawError } = await supabase
    .from("radar_lead_raw")
    .insert({
      source_id: sourceId,
      raw_payload: { text: rawPostText, submittedBy: admin.id },
    })
    .select("id")
    .single();
  if (rawError || !raw) {
    return { error: rawError?.message || "Failed to save the raw record." };
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("radar_lead_candidates")
    .insert({
      raw_id: raw.id,
      source_id: sourceId,
      notes_from_source: rawPostText,
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
    changed_by: admin.id,
  });
  if (historyError) {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Lead candidate ${candidate.candidate_code} created, but its initial status history row failed:`,
      historyError
    );
  }

  let extraction;
  try {
    extraction = await extractLeadRequirements(rawPostText);
  } catch (err) {
    const invalid = err instanceof InvalidLeadExtractionError;
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Lead extraction ${invalid ? "returned an invalid result" : "failed"} for candidate ${candidate.candidate_code}:`,
      err
    );
    return {
      error: `AI extraction ${invalid ? "returned an invalid result and nothing was saved" : "failed and nothing was saved"}. The candidate record itself was created (${candidate.candidate_code}) and can be reviewed manually.`,
    };
  }

  if (!extraction.configured) {
    return {
      error: `OPENAI_API_KEY is not configured — the candidate record was created (${candidate.candidate_code}), but no extraction was run.`,
    };
  }

  const result = extraction.extraction;

  const { error: analysisError } = await supabase.from("radar_lead_analysis").insert({
    candidate_id: candidate.id,
    version: 1,
    model_name: extraction.modelName,
    model_version: extraction.modelVersion,
    // FACT vs AI_INFERENCE kept structurally separate, same principle as
    // Property Radar's radar_property_analysis: `facts` is the literal
    // structured extraction (also denormalized onto the candidate below),
    // `ai_inference`/`evidence` hold the free-form, evidenced requirements
    // that don't map to a fixed column.
    facts: {
      intent: result.intent,
      property_type: result.property_type,
      location: result.location,
      budget_min: result.budget_min,
      budget_max: result.budget_max,
      bedrooms_min: result.bedrooms_min,
      timeline: result.timeline,
    },
    ai_inference: { requirements: result.requirements },
    unknowns: result.unknowns,
    intent_category: result.intent_category,
    intent_score: result.intent_score,
    confidence: result.confidence,
    evidence: { requirements: result.requirements },
  });
  if (analysisError) {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Extraction succeeded but failed to persist analysis for ${candidate.candidate_code}:`,
      analysisError
    );
    return {
      error: `AI extraction succeeded but saving the analysis failed. Nothing further was run for ${candidate.candidate_code}.`,
    };
  }

  // Denormalize onto the candidate — same pattern as Property Radar's
  // poster_type/acquisition_type sync (Phase 8D-2). Only ever writes a
  // value the target enum actually defines; UNKNOWN/null are left
  // untouched rather than forced into a column that has no UNKNOWN member.
  const candidateUpdate: Record<string, unknown> = { status: "AI_REVIEWED" };
  if (result.intent !== "UNKNOWN") candidateUpdate.purpose = result.intent;
  if (result.property_type !== "UNKNOWN") candidateUpdate.property_type = result.property_type;
  if (result.location.province) candidateUpdate.province = result.location.province;
  if (result.location.city) candidateUpdate.city = result.location.city;
  if (result.location.district) candidateUpdate.district = result.location.district;
  if (result.budget_min != null) candidateUpdate.budget_min = result.budget_min;
  if (result.budget_max != null) candidateUpdate.budget_max = result.budget_max;
  if (result.bedrooms_min != null) candidateUpdate.bedrooms = result.bedrooms_min;
  if (result.timeline) candidateUpdate.timeline = result.timeline;

  const { error: candidateUpdateError } = await supabase
    .from("radar_lead_candidates")
    .update(candidateUpdate)
    .eq("id", candidate.id);

  if (!candidateUpdateError) {
    await supabase.from("radar_lead_status_history").insert({
      candidate_id: candidate.id,
      from_status: "DISCOVERED",
      to_status: "AI_REVIEWED",
      changed_by: admin.id,
      note: "AI extraction completed",
    });
  } else {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Analysis saved but syncing candidate ${candidate.candidate_code}'s denormalized fields failed:`,
      candidateUpdateError
    );
  }

  // Translate into the EXISTING matching engine's input shape — no second
  // matching implementation. purpose/propertyType are read back from
  // `result` directly (not the DB row) so a denormalization failure above
  // still lets matching run against what was actually extracted.
  const { criteria, limitations } = leadRequirementsToMatchingPreferences({
    purpose: result.intent === "UNKNOWN" ? null : result.intent,
    propertyType: result.property_type === "UNKNOWN" ? null : result.property_type,
    city: result.location.city,
    district: result.location.district,
    budgetMin: result.budget_min,
    budgetMax: result.budget_max,
    bedroomsMin: result.bedrooms_min,
  });

  let matches: LeadMatchedProperty[] = [];
  let totalCandidatePool = 0;

  if (criteria) {
    const { properties } = await getProperties();
    const candidatePool = properties.filter((p) => getListingType(p) === criteria.purpose);
    totalCandidatePool = candidatePool.length;

    const { weights } = await getActiveMatchWeights();
    const ranked = rankMatches(criteria, candidatePool, weights, 5);

    // Admin-only display enrichment: look up each match's real SP-######
    // property_code for the "Property Code" column the test UI shows.
    // public_properties (what getProperties() reads) deliberately excludes
    // property_code, so this reads the base table directly via the
    // service-role client already in scope — display only, never touches
    // the matching engine or any public-facing query.
    const supabaseIds = ranked.map((r) => r.property.supabaseId).filter((id): id is string => Boolean(id));
    const codeById = new Map<string, string>();
    if (supabaseIds.length > 0) {
      const { data: codeRows } = await supabase.from("properties").select("id, property_code").in("id", supabaseIds);
      for (const row of codeRows ?? []) {
        codeById.set(row.id as string, row.property_code as string);
      }
    }

    matches = ranked.map((r) => ({
      propertyCode: r.property.supabaseId ? codeById.get(r.property.supabaseId) ?? null : null,
      title: r.property.title,
      price: r.property.price,
      location: r.property.location,
      overall: r.overall,
      reasons: r.reasons,
    }));
  }

  return {
    result: {
      candidateId: candidate.id,
      candidateCode: candidate.candidate_code,
      extraction: result,
      limitations,
      matches,
      totalCandidatePool,
    },
  };
}
