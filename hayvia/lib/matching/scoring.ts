import { getListingType, type Property } from "@/data/properties";
import type { MatchBreakdown, MatchCriteria, MatchWeights } from "@/lib/matching/types";

// -----------------------------------------------------------------------------
// Deterministic matching engine.
// -----------------------------------------------------------------------------
// Every function here is pure: same criteria + same property + same weights
// always produces the same numbers. No randomness anywhere. Each of the 7
// components mirrors a column in matching_weights exactly. Two fields the
// Get Matched form collects (Bathrooms, and Furnished/Parking/Minimum Size)
// have no dedicated weight column in the real schema — see DATABASE_SCHEMA.md,
// matching_weights has exactly 7 weighted components — so they're folded
// into the closest real bucket (documented at each fold point below) rather
// than inventing an 8th weight the schema doesn't have.
// -----------------------------------------------------------------------------

export interface MatchResult {
  property: Property;
  overall: number;
  breakdown: MatchBreakdown;
  reasons: string[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function budgetScore(criteria: MatchCriteria, property: Property): number {
  if (criteria.budgetMin == null && criteria.budgetMax == null) return 100;
  const min = criteria.budgetMin ?? 0;
  const max = criteria.budgetMax ?? Infinity;
  if (property.price >= min && property.price <= max) return 100;
  if (property.price < min) return 100; // cheaper than the floor is still affordable
  const overshoot = (property.price - max) / max;
  return Math.round(clamp(100 - overshoot * 100));
}

function locationScore(criteria: MatchCriteria, property: Property): number {
  if (criteria.preferredAreas.length === 0) return 100;
  return criteria.preferredAreas.includes(property.district) ? 100 : 40;
}

function propertyTypeScore(criteria: MatchCriteria, property: Property): number {
  if (criteria.propertyType === "Any") return 100;
  return property.propertyType === criteria.propertyType ? 100 : 0;
}

function bedroomsRequestToNumber(value: MatchCriteria["bedrooms"]): number | null {
  if (value === "Any") return null;
  if (value === "Studio") return 0;
  if (value === "3+") return 3;
  return Number(value);
}

function bedroomsOnlyScore(criteria: MatchCriteria, property: Property): number {
  const requested = bedroomsRequestToNumber(criteria.bedrooms);
  if (requested == null) return 100;
  if (criteria.bedrooms === "3+") return property.bedrooms >= 3 ? 100 : clamp(40 + property.bedrooms * 20);
  const diff = property.bedrooms - requested;
  if (diff === 0) return 100;
  if (diff > 0) return 85; // more space than asked for
  return Math.round(clamp(100 + diff * 30));
}

function bathroomsRequestToNumber(value: MatchCriteria["bathrooms"]): number | null {
  if (value === "Any") return null;
  if (value === "3+") return 3;
  return Number(value);
}

function bathroomsOnlyScore(criteria: MatchCriteria, property: Property): number {
  const requested = bathroomsRequestToNumber(criteria.bathrooms);
  if (requested == null) return 100;
  if (criteria.bathrooms === "3+") return property.bathrooms >= 3 ? 100 : clamp(40 + property.bathrooms * 20);
  const diff = property.bathrooms - requested;
  if (diff === 0) return 100;
  if (diff > 0) return 90;
  return Math.round(clamp(100 + diff * 30));
}

// Bathrooms has no dedicated weight in matching_weights — folded into the
// Bedrooms component (70% bedrooms / 30% bathrooms) since both are "space"
// requirements and this keeps the breakdown aligned to the real 7 columns.
function bedroomsScore(criteria: MatchCriteria, property: Property): number {
  return Math.round(0.7 * bedroomsOnlyScore(criteria, property) + 0.3 * bathroomsOnlyScore(criteria, property));
}

function amenityTextIncludes(property: Property, pattern: RegExp): boolean {
  return property.amenities.some((amenity) => pattern.test(amenity));
}

function lifestyleTagScore(tag: MatchCriteria["lifestyle"][number], property: Property): number {
  if (tag === "WIFI") return property.wifi ? 100 : 0;
  if (tag === "POOL") return amenityTextIncludes(property, /pool/i) ? 100 : 0;
  return amenityTextIncludes(property, /gym|fitness/i) ? 100 : 0; // GYM
}

function lifestyleScore(criteria: MatchCriteria, property: Property): number {
  if (criteria.lifestyle.length === 0) return 100;
  const scores = criteria.lifestyle.map((tag) => lifestyleTagScore(tag, property));
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

// Amenities has no dedicated input of its own on the form — it's the catch-all
// for "everything else real we can check": furnished match, parking match,
// minimum size, and general amenity richness (more listed amenities = higher
// score, capped at 5). Averaged evenly across whichever of these the user
// actually expressed a preference for; falls back to amenity richness alone
// if the user left every one of those fields at "no preference".
function amenitiesScore(criteria: MatchCriteria, property: Property): number {
  const parts: number[] = [];

  if (criteria.furnished !== "No preference") {
    parts.push(property.furnished === criteria.furnished ? 100 : 40);
  }
  if (criteria.parking === "Required") {
    parts.push(property.parking ? 100 : 0);
  }
  if (criteria.minSizeSqm != null) {
    parts.push(
      property.size >= criteria.minSizeSqm
        ? 100
        : Math.round(clamp(100 - ((criteria.minSizeSqm - property.size) / criteria.minSizeSqm) * 100))
    );
  }

  const richness = Math.round(clamp((property.amenities.length / 5) * 100));
  parts.push(richness);

  return Math.round(parts.reduce((sum, s) => sum + s, 0) / parts.length);
}

function availabilityScore(criteria: MatchCriteria, property: Property): number {
  if (!criteria.moveInDate) return 100;
  const desired = new Date(criteria.moveInDate).getTime();
  const available = new Date(property.availableDate).getTime();
  if (Number.isNaN(desired) || Number.isNaN(available)) return 100;
  const diffDays = (available - desired) / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) return 100; // already available by the desired date
  return Math.round(clamp(100 - diffDays * (100 / 60)));
}

export function scoreProperty(
  criteria: MatchCriteria,
  property: Property,
  weights: MatchWeights
): { breakdown: MatchBreakdown; overall: number } {
  const breakdown: MatchBreakdown = {
    budget: budgetScore(criteria, property),
    location: locationScore(criteria, property),
    propertyType: propertyTypeScore(criteria, property),
    bedrooms: bedroomsScore(criteria, property),
    lifestyle: lifestyleScore(criteria, property),
    amenities: amenitiesScore(criteria, property),
    availability: availabilityScore(criteria, property),
  };

  const overall = Math.round(
    (breakdown.budget * weights.budget +
      breakdown.location * weights.location +
      breakdown.propertyType * weights.propertyType +
      breakdown.bedrooms * weights.bedrooms +
      breakdown.lifestyle * weights.lifestyle +
      breakdown.amenities * weights.amenities +
      breakdown.availability * weights.availability) /
      100
  );

  return { breakdown, overall: clamp(overall) };
}

// Deterministic, derived only from the breakdown numbers actually computed
// above — never a separate/independent claim. Each reason is only included
// when the user expressed a preference for that dimension AND the property
// genuinely scored well against it.
function buildReasons(criteria: MatchCriteria, property: Property, breakdown: MatchBreakdown): string[] {
  const reasons: string[] = [];

  if ((criteria.budgetMin != null || criteria.budgetMax != null) && breakdown.budget >= 80) {
    reasons.push("Within your budget");
  }
  if (criteria.preferredAreas.length > 0 && breakdown.location === 100) {
    reasons.push("Located in your preferred area");
  }
  if (criteria.propertyType !== "Any" && breakdown.propertyType === 100) {
    reasons.push(`Matches your property type preference (${criteria.propertyType})`);
  }
  if (criteria.bedrooms !== "Any" && bedroomsOnlyScore(criteria, property) >= 85) {
    reasons.push("Matches your bedroom requirement");
  }
  if (criteria.bathrooms !== "Any" && bathroomsOnlyScore(criteria, property) >= 85) {
    reasons.push("Matches your bathroom requirement");
  }
  if (criteria.furnished !== "No preference" && property.furnished === criteria.furnished) {
    reasons.push(`Furnished as you prefer (${property.furnished.toLowerCase()})`);
  }
  if (criteria.parking === "Required" && property.parking) {
    reasons.push("Includes parking");
  }
  if (criteria.lifestyle.length > 0 && breakdown.lifestyle >= 80) {
    reasons.push("Suitable for your lifestyle preferences");
  }
  if (criteria.moveInDate && breakdown.availability === 100) {
    reasons.push("Available around your preferred move-in date");
  }
  if (getListingType(property) === criteria.purpose) {
    reasons.push(criteria.purpose === "rent" ? "Available to rent" : "Available for sale");
  }

  return reasons;
}

/**
 * Scores every candidate property, ranks by overall score descending, and
 * returns the top `limit`. `properties` should already be filtered to the
 * requested listing type (rent/buy) by the caller — see app/api/match/route.ts.
 */
export function rankMatches(
  criteria: MatchCriteria,
  properties: Property[],
  weights: MatchWeights,
  limit = 3
): MatchResult[] {
  return properties
    .map((property) => {
      const { breakdown, overall } = scoreProperty(criteria, property, weights);
      return { property, overall, breakdown, reasons: buildReasons(criteria, property, breakdown) };
    })
    .sort((a, b) => b.overall - a.overall)
    .slice(0, limit);
}
