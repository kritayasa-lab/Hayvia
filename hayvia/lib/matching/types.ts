import type { District, FurnishedStatus, ListingType, PropertyType } from "@/data/properties";

// The only lifestyle tags we can actually verify against real property data
// today (property.wifi, and substring matches against property.amenities).
// The matching_weights schema supports a 14-value lifestyle_preference_enum,
// but exposing tags we can't score (near beach, pet friendly, etc.) would
// mean either faking a match or always scoring them 0 — neither is honest,
// so only these three are offered anywhere in the UI.
export const supportedLifestyleTags = ["WIFI", "POOL", "GYM"] as const;
export type LifestyleTag = (typeof supportedLifestyleTags)[number];

export interface MatchCriteria {
  purpose: ListingType;
  preferredAreas: District[];
  propertyType: PropertyType | "Any";
  budgetMin?: number;
  budgetMax?: number;
  bedrooms: "Any" | "Studio" | "1" | "2" | "3+";
  bathrooms: "Any" | "1" | "2" | "3+";
  minSizeSqm?: number;
  furnished: FurnishedStatus | "No preference";
  parking: "Required" | "Not important";
  moveInDate?: string; // ISO date
  lifestyle: LifestyleTag[];
}

// Mirrors matching_weights (supabase/migrations/20260912100007_matching_engine.sql)
// exactly — seven components, must sum to 100.
export interface MatchWeights {
  budget: number;
  location: number;
  propertyType: number;
  bedrooms: number;
  lifestyle: number;
  amenities: number;
  availability: number;
}

export const defaultMatchWeights: MatchWeights = {
  budget: 30,
  location: 25,
  propertyType: 15,
  bedrooms: 10,
  lifestyle: 10,
  amenities: 5,
  availability: 5,
};

export interface MatchBreakdown {
  budget: number;
  location: number;
  propertyType: number;
  bedrooms: number;
  lifestyle: number;
  amenities: number;
  availability: number;
}
