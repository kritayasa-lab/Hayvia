import "server-only";
import type { District, ListingType, PropertyType } from "@/data/properties";
import type { MatchCriteria } from "@/lib/matching/types";

// -----------------------------------------------------------------------------
// Phase 8D — Lead Intelligence Foundation.
//
// Deterministic translation from a Lead Radar candidate's structured facts
// into the EXISTING matching engine's MatchCriteria (lib/matching/types.ts) —
// no new matching implementation. Per this phase's explicit "AI extracts,
// the database/matching engine applies hard filters" principle: the AI never
// sees this file's output and never decides what counts as a match. This
// adapter is pure and deterministic — same facts in, same MatchCriteria out.
//
// A field the AI extracted but this adapter cannot represent in
// MatchCriteria (an unmappable property type, a location string with no
// known district) is never silently dropped — it's reported in
// `limitations` so the admin test UI (and any future real UI) can show
// exactly what could not be used as a hard filter, rather than pretending
// the match ran against the poster's full stated requirements.
// -----------------------------------------------------------------------------

// Keyword -> District. Deliberately conservative and Hat Yai-specific
// (matches data/properties.ts's 4-value District union exactly, the same
// set the whole matching engine and public site already use) — an
// unrecognized location string is left unmapped rather than guessed.
const DISTRICT_KEYWORDS: Array<{ district: District; keywords: string[] }> = [
  { district: "Central Hat Yai", keywords: ["หาดใหญ่", "hat yai", "hatyai", "ใจกลางเมือง", "เมืองหาดใหญ่", "central"] },
  { district: "Kho Hong", keywords: ["คอหงส์", "kho hong", "khohong"] },
  { district: "PSU / University Area", keywords: ["ม.อ", "มอ.", "psu", "มหาวิทยาลัย", "university"] },
  { district: "Khlong Hae", keywords: ["คลองแห", "khlong hae", "khlonghae"] },
];

function matchDistrict(district: string | null, city: string | null): District | null {
  const haystack = [district, city].filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return null;
  for (const entry of DISTRICT_KEYWORDS) {
    if (entry.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return entry.district;
    }
  }
  return null;
}

// property_type_enum (full DB set) -> the matching engine's 4-value
// PropertyType union. Mirrors lib/properties-source.ts's
// supabasePropertyTypeMap exactly — VILLA/LAND/COMMERCIAL/OTHER have no
// equivalent in MatchCriteria today, a pre-existing constraint this adapter
// doesn't try to work around.
const REPRESENTABLE_PROPERTY_TYPES: Partial<Record<string, PropertyType>> = {
  CONDO: "Condo",
  APARTMENT: "Apartment",
  HOUSE: "House",
  TOWNHOUSE: "Townhouse",
};

export interface LeadCandidateFacts {
  /** listing_type_enum value, or null when intent is UNKNOWN/not extracted. */
  purpose: "BUY" | "RENT" | null;
  /** property_type_enum value, or null when not extracted/UNKNOWN. */
  propertyType: string | null;
  city: string | null;
  district: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  bedroomsMin: number | null;
}

export interface LeadMatchingTranslation {
  /** Null when matching cannot run at all (purpose is required by MatchCriteria/rankMatches). */
  criteria: MatchCriteria | null;
  /** Human-readable notes on any requirement this translation could not represent as a hard filter. */
  limitations: string[];
}

function bedroomsMinToCriteria(bedroomsMin: number | null): MatchCriteria["bedrooms"] {
  if (bedroomsMin == null) return "Any";
  if (bedroomsMin <= 0) return "Studio";
  if (bedroomsMin >= 3) return "3+";
  return String(bedroomsMin) as "1" | "2";
}

/**
 * leadRequirementsToMatchingPreferences() — the ONE adapter between Lead
 * Radar and the existing matching engine. Never calls rankMatches() itself;
 * the caller (app/admin/(dashboard)/radar/leads/test/actions.ts) does that
 * with the criteria this returns, exactly the way app/api/match/route.ts
 * already does for the public "Get Matched" flow.
 */
export function leadRequirementsToMatchingPreferences(facts: LeadCandidateFacts): LeadMatchingTranslation {
  const limitations: string[] = [];

  if (facts.purpose == null) {
    limitations.push("Intent (buy vs. rent) was not extracted — matching requires a known purpose and did not run.");
    return { criteria: null, limitations };
  }
  const purpose: ListingType = facts.purpose === "BUY" ? "sale" : "rent";

  let propertyType: PropertyType | "Any" = "Any";
  if (facts.propertyType) {
    const mapped = REPRESENTABLE_PROPERTY_TYPES[facts.propertyType];
    if (mapped) {
      propertyType = mapped;
    } else {
      limitations.push(
        `Property type "${facts.propertyType}" has no equivalent in the matching engine's property type filter — matched without one.`
      );
    }
  }

  const matchedDistrict = matchDistrict(facts.district, facts.city);
  const preferredAreas: District[] = matchedDistrict ? [matchedDistrict] : [];
  if ((facts.district || facts.city) && !matchedDistrict) {
    limitations.push(
      `Location "${[facts.district, facts.city].filter(Boolean).join(", ")}" did not match a known district — matched without a location filter.`
    );
  }

  const criteria: MatchCriteria = {
    purpose,
    preferredAreas,
    propertyType,
    budgetMin: facts.budgetMin ?? undefined,
    budgetMax: facts.budgetMax ?? undefined,
    bedrooms: bedroomsMinToCriteria(facts.bedroomsMin),
    bathrooms: "Any",
    furnished: "No preference",
    parking: "Not important",
    lifestyle: [],
  };

  return { criteria, limitations };
}
