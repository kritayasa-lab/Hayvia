// -----------------------------------------------------------------------------
// Shared /properties filter defaults + query-param resolution.
// -----------------------------------------------------------------------------
// Deliberately NOT in PropertiesExplorer.tsx: that file is "use client", and
// every export from a "use client" module becomes an opaque client
// reference when imported into a Server Component — calling a plain
// function like `resolveInitialFilters` from app/properties/page.tsx (a
// Server Component) would fail at render time. This module has no "use
// client" directive, so it's safe to import — and call — from both the
// server (the page, to read searchParams) and the client (PropertiesExplorer,
// for its option lists and defaults).
// -----------------------------------------------------------------------------

import { districts, propertyTypes, type District, type PropertyType } from "@/data/properties";
import { PROVINCES, PROVINCE_AMPHOE } from "@/lib/locations/province-amphoe";

export const budgetOptions = [
  { label: "Any budget", min: 0, max: Infinity },
  { label: "Below ฿10,000", min: 0, max: 9999 },
  { label: "฿10,000–15,000", min: 10000, max: 15000 },
  { label: "฿15,000–20,000", min: 15000, max: 20000 },
  { label: "฿20,000–30,000", min: 20000, max: 30000 },
  { label: "฿30,000+", min: 30000, max: Infinity },
];

export const bedroomOptions = ["Any", "Studio", "1", "2", "3+"];

export const bathroomOptions = ["Any", "1", "2", "3+"];

export const sortOptions = [
  "Recommended",
  "Price: Low to High",
  "Price: High to Low",
  "Newest",
] as const;

export type SortOption = (typeof sortOptions)[number];

export const listingTypeOptions = ["Any", "Rent", "Sale"] as const;
export type ListingTypeOption = (typeof listingTypeOptions)[number];

// "Any province" plus the two V1 target provinces -- deliberately separate
// from `districts`/`District` above (the existing Hat Yai neighborhood
// filter, which lib/matching/* also depends on and is left untouched).
export const provinceOptions = ["Any province", ...PROVINCES] as const;
export type ProvinceOption = (typeof provinceOptions)[number];

// Every Amphoe across both provinces, flattened -- used only to validate a
// query-string value (we don't know which province it belongs to from the
// string alone). The actual dependent option list shown in the filter UI
// is derived from PROVINCE_AMPHOE[province] at render time, same pattern
// as the admin Property Form's Province/Amphoe selector.
const allAmphoe = Object.values(PROVINCE_AMPHOE).flat();

export const defaultFilters = {
  listingType: "Any" as ListingTypeOption,
  location: "Any location",
  province: "Any province" as ProvinceOption,
  amphoe: "Any amphoe",
  propertyType: "Any type",
  budget: budgetOptions[0].label,
  bedrooms: "Any",
  bathrooms: "Any",
  minSize: "",
  furnished: "Any",
  parking: "Any",
  // Songkhla-gated flood-safe inventory filter -- see PropertiesExplorer.tsx.
  // Never true by default; only reachable when province = Songkhla.
  floodSafeOnly: false,
};

export type PropertiesFilters = typeof defaultFilters;

// Raw values as they'd arrive from a URL query string (e.g. from the
// homepage SearchBar, or a direct link) — everything optional/untrusted.
export interface PropertiesSearchParams {
  listingType?: string;
  location?: string;
  province?: string;
  amphoe?: string;
  type?: string;
  budget?: string;
  bedrooms?: string;
  floodSafe?: string;
}

/**
 * Validates raw query-string values against the known option lists and
 * merges them onto `defaultFilters`. Anything missing or not a recognized
 * value falls back to the existing default — so a plain `/properties` visit
 * (no params) behaves exactly as before.
 */
export function resolveInitialFilters(
  searchParams: PropertiesSearchParams | undefined
): PropertiesFilters {
  if (!searchParams) return defaultFilters;

  const listingType =
    searchParams.listingType?.toLowerCase() === "rent"
      ? "Rent"
      : searchParams.listingType?.toLowerCase() === "sale"
        ? "Sale"
        : defaultFilters.listingType;

  const location = districts.includes(searchParams.location as District)
    ? (searchParams.location as District)
    : defaultFilters.location;

  const province = provinceOptions.includes(searchParams.province as ProvinceOption)
    ? (searchParams.province as ProvinceOption)
    : defaultFilters.province;

  const amphoe = allAmphoe.includes(searchParams.amphoe ?? "")
    ? (searchParams.amphoe as string)
    : defaultFilters.amphoe;

  // Only honored when it arrives paired with province=Songkhla -- matches
  // the UI, which only ever shows/enables this toggle in that state.
  const floodSafeOnly = province === "Songkhla" && searchParams.floodSafe === "1";

  const propertyType = propertyTypes.includes(searchParams.type as PropertyType)
    ? (searchParams.type as PropertyType)
    : defaultFilters.propertyType;

  const budget = budgetOptions.some((option) => option.label === searchParams.budget)
    ? (searchParams.budget as string)
    : defaultFilters.budget;

  const bedrooms = bedroomOptions.includes(searchParams.bedrooms ?? "")
    ? (searchParams.bedrooms as string)
    : defaultFilters.bedrooms;

  return {
    ...defaultFilters,
    listingType,
    location,
    province,
    amphoe,
    propertyType,
    budget,
    bedrooms,
    floodSafeOnly,
  };
}
