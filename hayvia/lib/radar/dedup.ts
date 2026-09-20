import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// Phase 8C — Property Radar deduplication.
//
// Rule-based only, deliberately — no AI, no fuzzy title matching (title
// similarity alone is explicitly not a reliable identity signal: two
// unrelated listings can share a generic title, and the same real property
// can be titled differently across sources). Compares a candidate's
// normalized facts against every OPEN existing candidate on district +
// property type + bedrooms (exact) and price (within a tolerance).
//
// This never merges or silently drops anything — it only returns possible
// matches for a human to confirm via the "Mark Duplicate" action. The
// tolerance is a plain constant, not a config table, per Phase 8C's
// "minimum schema" instruction; it's isolated here so it can be tuned later
// without touching call sites.
// -----------------------------------------------------------------------------

export const PROPERTY_RADAR_PRICE_TOLERANCE = 0.1;

// Candidates in these statuses are no longer "open" — a DISMISSED/EXPIRED
// candidate isn't an active opportunity to collide with, a DUPLICATE is
// already resolved, and a CONVERTED one is already a real property (its own
// duplicate-of-a-real-property concern belongs to property creation, not
// candidate dedup).
const CLOSED_STATUSES = ["DISMISSED", "DUPLICATE", "EXPIRED", "CONVERTED"];

export interface PropertyDedupFacts {
  district: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  price: number | null;
}

export interface PossibleDuplicateCandidate {
  id: string;
  candidateCode: string;
  status: string;
  district: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  price: number | null;
}

/**
 * Finds existing OPEN Property Radar candidates that plausibly describe the
 * same real property as `facts`. Requires district, property type, and
 * bedrooms to match exactly, and price to be within
 * PROPERTY_RADAR_PRICE_TOLERANCE of each other. Any field left null on the
 * incoming facts is treated as "can't compare" for that dimension — a
 * candidate missing district, for instance, will never match on district
 * alone, so it can't produce a false-confidence match from absent data.
 */
export async function findPossibleDuplicateCandidates(
  supabase: SupabaseClient,
  facts: PropertyDedupFacts,
  excludeCandidateId?: string
): Promise<PossibleDuplicateCandidate[]> {
  if (!facts.district || !facts.propertyType || facts.bedrooms == null || facts.price == null) {
    // Not enough normalized data to compare safely — never guess a match
    // from partial information.
    return [];
  }

  let query = supabase
    .from("radar_property_candidates")
    .select("id, candidate_code, status, district, property_type, bedrooms, price")
    .eq("property_type", facts.propertyType)
    .eq("bedrooms", facts.bedrooms)
    .ilike("district", facts.district)
    .not("status", "in", `(${CLOSED_STATUSES.join(",")})`);

  if (excludeCandidateId) {
    query = query.neq("id", excludeCandidateId);
  }

  const { data, error } = await query;
  if (error || !data) {
    // eslint-disable-next-line no-console
    if (error) console.error("[Subphiphat Admin] Radar dedup lookup failed:", error);
    return [];
  }

  const minPrice = facts.price * (1 - PROPERTY_RADAR_PRICE_TOLERANCE);
  const maxPrice = facts.price * (1 + PROPERTY_RADAR_PRICE_TOLERANCE);

  return data
    .filter((row) => row.price != null && row.price >= minPrice && row.price <= maxPrice)
    .map((row) => ({
      id: row.id as string,
      candidateCode: row.candidate_code as string,
      status: row.status as string,
      district: row.district as string | null,
      propertyType: row.property_type as string | null,
      bedrooms: row.bedrooms as number | null,
      price: row.price as number | null,
    }));
}
