import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPropertyToSupabase, propertyTypeMap, furnishedMap } from "@/lib/supabase/properties-sync";
import type { MatchResult } from "@/lib/matching/scoring";
import type { MatchCriteria } from "@/lib/matching/types";

function bedroomsToColumn(value: MatchCriteria["bedrooms"]): number | null {
  if (value === "Any") return null;
  if (value === "Studio") return 0;
  if (value === "3+") return 3;
  return Number(value);
}

function bathroomsToColumn(value: MatchCriteria["bathrooms"]): number | null {
  if (value === "Any") return null;
  if (value === "3+") return 3;
  return Number(value);
}

/**
 * Saves one Get Matched run to Supabase: a matching_preferences row (the
 * quiz answers) and a matching_results row per returned match (the computed
 * score + breakdown, for transparency/admin visibility later — always
 * derived from the same numbers already shown to the user, never
 * recalculated differently here).
 *
 * Guest-compatible: matching_preferences.user_id stays null, session_id
 * carries a fresh id for this run instead (the table's own CHECK constraint
 * requires one of the two — see supabase/migrations/20260912100007_matching_engine.sql).
 *
 * Throws on failure so the caller can report an honest "couldn't save"
 * state — this function never silently succeeds.
 */
export async function persistMatchingRun(
  criteria: MatchCriteria,
  results: MatchResult[]
): Promise<{ matchingPreferenceId: string }> {
  const supabase = createAdminClient();

  const { data: preference, error: preferenceError } = await supabase
    .from("matching_preferences")
    .insert({
      session_id: crypto.randomUUID(),
      purpose: criteria.purpose === "sale" ? "BUY" : "RENT",
      province: "Songkhla",
      city: "Hat Yai",
      // matching_preferences.district is a single text column; "Preferred
      // Areas" is a multi-select on the form, so multiple selections are
      // stored as a comma-joined string rather than losing the rest.
      district: criteria.preferredAreas.length > 0 ? criteria.preferredAreas.join(", ") : null,
      budget_min: criteria.budgetMin ?? null,
      budget_max: criteria.budgetMax ?? null,
      property_type: criteria.propertyType === "Any" ? null : propertyTypeMap[criteria.propertyType],
      bedrooms: bedroomsToColumn(criteria.bedrooms),
      bathrooms: bathroomsToColumn(criteria.bathrooms),
      furnished: criteria.furnished === "No preference" ? null : furnishedMap[criteria.furnished],
      parking: criteria.parking === "Required" ? true : null,
      lifestyle_preferences: criteria.lifestyle,
      min_size_sqm: criteria.minSizeSqm ?? null,
    })
    .select("id")
    .single();

  if (preferenceError || !preference) {
    throw new Error(
      `Failed to save matching_preferences: ${preferenceError?.message ?? "unknown error"}`
    );
  }

  for (const result of results) {
    const propertyId = await syncPropertyToSupabase(result.property);
    const { error: resultError } = await supabase.from("matching_results").insert({
      matching_preference_id: preference.id,
      property_id: propertyId,
      match_score: result.overall,
      score_breakdown: result.breakdown,
    });
    if (resultError) {
      throw new Error(`Failed to save matching_results for ${result.property.slug}: ${resultError.message}`);
    }
  }

  // Unified CRM layer — matches the leads table's own CHECK constraint for
  // source_type = MATCHING (must carry matching_preference_id). Best-effort:
  // the preferences + results above are already safely saved regardless.
  const { error: leadError } = await supabase.from("leads").insert({
    source_type: "MATCHING",
    matching_preference_id: preference.id,
    lead_type: criteria.purpose === "sale" ? "BUY" : "RENT",
    status: "NEW",
  });
  if (leadError) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Matching run saved, but creating its CRM lead row failed:", leadError);
  }

  return { matchingPreferenceId: preference.id as string };
}
