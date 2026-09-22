"use server";

import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateManualSource } from "@/lib/radar/sources";
import { classifyLeadCandidate, type LeadMatchedProperty } from "@/lib/radar/lead-intelligence";
import type { LeadRequirementExtraction } from "@/lib/radar/lead-requirement-schema";

// -----------------------------------------------------------------------------
// Phase 8D — Lead Intelligence Foundation. Manual proof-of-flow action:
//
//   raw post -> radar_lead_raw/radar_lead_candidates (staging, exactly like
//   Property Radar's manual intake) -> AI classification
//   (lib/radar/lead-intelligence.ts's classifyLeadCandidate(), PR #25) ->
//   the EXISTING matching engine (unmodified), for BUYER/RENTER only.
//
// PR #25 refactor: this action still owns creating the raw+candidate rows
// from directly-typed text (a manual test has no pre-existing raw_id to
// promote), but no longer duplicates classification/analysis/matching
// logic — that now lives once in lib/radar/lead-intelligence.ts, shared
// with the Apify Dataset import flow. This page's own behavior is
// unchanged: same inputs, same outputs, same staging-only guarantees below.
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

  const outcome = await classifyLeadCandidate(supabase, candidate.id as string, admin.id);

  if (!outcome.ok) {
    if (outcome.reason === "not_configured") {
      return {
        error: `OPENAI_API_KEY is not configured — the candidate record was created (${candidate.candidate_code}), but no classification was run.`,
      };
    }
    return {
      error: `${outcome.error} The candidate record itself was created (${candidate.candidate_code}) and can be reviewed manually.`,
    };
  }

  return {
    result: {
      candidateId: outcome.candidateId,
      candidateCode: outcome.candidateCode,
      extraction: outcome.extraction,
      limitations: outcome.limitations,
      matches: outcome.matches,
      totalCandidatePool: outcome.totalCandidatePool,
    },
  };
}
