// -----------------------------------------------------------------------------
// POST /api/match
// -----------------------------------------------------------------------------
// The real matching engine behind /get-matched. Guest-first — no auth
// required. Runs entirely server-side:
//   1. Score every currently-real property (Google Sheets, with the demo
//      fallback — same source as the rest of the site, see
//      lib/properties-source.ts) deterministically against the submitted
//      criteria (lib/matching/scoring.ts — no randomness anywhere).
//   2. Take the top 3.
//   3. Best-effort: save the run to Supabase (matching_preferences +
//      matching_results + a CRM leads row) and forward a summary to the
//      existing Google Apps Script sheet. Neither of these can fail the
//      request — the scored results don't depend on Supabase being up —
//      but neither is ever reported as having succeeded when it didn't.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { districts, propertyTypes, type District, type PropertyType, getListingType } from "@/data/properties";
import { getProperties } from "@/lib/properties-source";
import { rankMatches } from "@/lib/matching/scoring";
import { getActiveMatchWeights } from "@/lib/matching/weights";
import { persistMatchingRun } from "@/lib/matching/persist";
import { forwardToGoogleAppsScript } from "@/lib/google-apps-script";
import { supportedLifestyleTags, type LifestyleTag, type MatchCriteria } from "@/lib/matching/types";

export const dynamic = "force-dynamic";

interface RawCriteria {
  purpose?: string;
  preferredAreas?: unknown;
  propertyType?: string;
  budgetMin?: unknown;
  budgetMax?: unknown;
  bedrooms?: string;
  bathrooms?: string;
  minSizeSqm?: unknown;
  furnished?: string;
  parking?: string;
  moveInDate?: string;
  lifestyle?: unknown;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function parseCriteria(raw: RawCriteria): MatchCriteria | { error: string } {
  if (raw.purpose !== "rent" && raw.purpose !== "sale") {
    return { error: "Please choose Rent or Buy." };
  }

  const preferredAreas = Array.isArray(raw.preferredAreas)
    ? raw.preferredAreas.filter((area): area is District => districts.includes(area as District))
    : [];

  const propertyType: PropertyType | "Any" =
    raw.propertyType && propertyTypes.includes(raw.propertyType as PropertyType)
      ? (raw.propertyType as PropertyType)
      : "Any";

  const bedrooms = (["Any", "Studio", "1", "2", "3+"] as const).includes(raw.bedrooms as never)
    ? (raw.bedrooms as MatchCriteria["bedrooms"])
    : "Any";

  const bathrooms = (["Any", "1", "2", "3+"] as const).includes(raw.bathrooms as never)
    ? (raw.bathrooms as MatchCriteria["bathrooms"])
    : "Any";

  const furnished = (["Fully furnished", "Partially furnished", "Unfurnished", "No preference"] as const).includes(
    raw.furnished as never
  )
    ? (raw.furnished as MatchCriteria["furnished"])
    : "No preference";

  const parking = raw.parking === "Required" ? "Required" : "Not important";

  const lifestyle = Array.isArray(raw.lifestyle)
    ? raw.lifestyle.filter((tag): tag is LifestyleTag => supportedLifestyleTags.includes(tag as LifestyleTag))
    : [];

  return {
    purpose: raw.purpose,
    preferredAreas,
    propertyType,
    budgetMin: toNumberOrUndefined(raw.budgetMin),
    budgetMax: toNumberOrUndefined(raw.budgetMax),
    bedrooms,
    bathrooms,
    minSizeSqm: toNumberOrUndefined(raw.minSizeSqm),
    furnished,
    parking,
    moveInDate: raw.moveInDate || undefined,
    lifestyle,
  };
}

export async function POST(request: Request) {
  let rawBody: RawCriteria;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const criteria = parseCriteria(rawBody);
  if ("error" in criteria) {
    return NextResponse.json({ success: false, error: criteria.error }, { status: 400 });
  }

  const { properties } = await getProperties();
  const candidates = properties.filter((p) => getListingType(p) === criteria.purpose);

  const { weights } = await getActiveMatchWeights();
  const results = rankMatches(criteria, candidates, weights, 3);

  let saved = false;
  try {
    await persistMatchingRun(criteria, results);
    saved = true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Matching results computed, but saving the run to Supabase failed:", error);
  }

  // Best-effort notification alongside the real result — never blocks or
  // fails the response either way.
  forwardToGoogleAppsScript({
    source: "get-matched",
    submittedAt: new Date().toISOString(),
    purpose: criteria.purpose,
    preferredAreas: criteria.preferredAreas.join(", "),
    propertyType: criteria.propertyType,
    budgetMin: criteria.budgetMin,
    budgetMax: criteria.budgetMax,
    bedrooms: criteria.bedrooms,
    bathrooms: criteria.bathrooms,
    furnished: criteria.furnished,
    parking: criteria.parking,
    moveInDate: criteria.moveInDate,
    lifestyle: criteria.lifestyle.join(", "),
    topMatches: results.map((r) => `${r.property.title} (${r.overall}%)`).join("; "),
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    saved,
    totalCandidates: candidates.length,
    results: results.map((r) => ({
      property: r.property,
      overall: r.overall,
      breakdown: r.breakdown,
      reasons: r.reasons,
    })),
  });
}
