// -----------------------------------------------------------------------------
// Property data source
// -----------------------------------------------------------------------------
// PRIMARY source: the "HAYVIA — Properties" Google Sheet, read through the
// existing Google Apps Script Web App (config/integrations.ts) via a GET
// request. This file is server-only — it's used by Server Components and by
// app/api/properties/route.ts, never imported into client components.
//
// FALLBACK: if the Google Sheets fetch fails, times out, or returns an
// invalid/empty response, we fall back to the hardcoded demo data in
// data/properties.ts so the site never shows a broken or blank page. That
// hardcoded data is untouched — see data/properties.ts.
//
// This fallback is intentionally isolated to the `fetchPropertiesFromSheet` /
// `getProperties` pair below so it can be removed cleanly later (once Google
// Sheets has been fully tested) by deleting the try/catch fallback branch in
// `getProperties` and importing directly from data/properties.ts is no longer
// needed anywhere else in the app.
// -----------------------------------------------------------------------------

import { cache } from "react";
import { GOOGLE_APPS_SCRIPT_URL } from "@/config/integrations";
import {
  properties as demoProperties,
  type Property,
} from "@/data/properties";
import { slugify } from "@/lib/utils";

export type PropertiesSource = "sheets" | "fallback";

interface RawSheetRow {
  [header: string]: unknown;
}

interface AppsScriptPropertiesResponse {
  success?: boolean;
  error?: string;
  properties?: RawSheetRow[];
}

// -----------------------------------------------------------------------------
// Small, defensive parsing helpers — every one of these is designed to
// degrade gracefully (return a safe default) rather than throw, since a
// single malformed cell in the sheet should never take down the whole
// listing page.
// -----------------------------------------------------------------------------

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const digits = str(value).replace(/[^0-9.]/g, "");
  const parsed = parseFloat(digits);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseBedrooms(value: unknown): number {
  const raw = str(value).toLowerCase();
  if (!raw) return 0;
  if (raw === "studio") return 0;
  const match = raw.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function parseBoolean(value: unknown): boolean {
  const raw = str(value).toLowerCase();
  return ["yes", "true", "y", "required", "available", "1"].includes(raw);
}

function parseList(value: unknown): string[] {
  return str(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeDateString(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const raw = str(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function parseImages(row: RawSheetRow): string[] {
  const images: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const value = str(row[`Image ${i}`]);
    if (value) images.push(value);
  }
  // Guarantee at least one image so components that assume images[0] exists
  // (PropertyCard, the detail page's generateMetadata) never break.
  if (images.length === 0) {
    images.push("/images/hero-living-room.jpg");
  }
  return images;
}

function isRowEmpty(row: RawSheetRow): boolean {
  return Object.values(row).every((value) => str(value) === "");
}

/**
 * Converts one raw Google Sheets row (already keyed by header name by the
 * Apps Script) into the app's existing Property shape. Returns null for rows
 * that should be skipped entirely (empty rows, or Hidden status — the Apps
 * Script already excludes Hidden rows, but we check again defensively).
 */
function mapSheetRowToProperty(row: RawSheetRow): Property | null {
  if (!row || isRowEmpty(row)) return null;

  const status = str(row["Status"]).toLowerCase();
  if (status === "hidden") return null;

  const id = str(row["ID"]);
  const title = str(row["Title"]);
  if (!id && !title) return null; // nothing usable to display

  const rawSlug = str(row["Slug"]);
  const slug = rawSlug || `${slugify(title || id)}-${id || "0"}`;

  const normalizedStatus: Property["status"] =
    status === "reserved" ? "reserved" : status === "rented" ? "rented" : "available";

  return {
    id: id || slug,
    slug,
    title: title || "Untitled property",
    location: str(row["Location"]) || str(row["Area"]),
    // District type is a known 4-value union used only for the filter
    // dropdown list; sheet values are trusted to match (dropdowns are
    // already configured) and cast here rather than validated at runtime,
    // so an unexpected value can never crash rendering — it just won't
    // match a filter option, which is a safe, graceful degradation.
    district: (str(row["Area"]) || "Central Hat Yai") as Property["district"],
    price: parseNumber(row["Monthly Rent"]),
    propertyType: (str(row["Property Type"]) || "Condo") as Property["propertyType"],
    bedrooms: parseBedrooms(row["Bedrooms"]),
    bathrooms: parseNumber(row["Bathrooms"], 1),
    size: parseNumber(row["Size (sqm)"]),
    furnished: (str(row["Furnished"]) || "Unfurnished") as Property["furnished"],
    parking: parseBoolean(row["Parking"]),
    wifi: parseBoolean(row["WiFi"]),
    availableDate: safeDateString(row["Available Date"]),
    minimumLease: str(row["Minimum Rental"]),
    deposit: str(row["Deposit"]),
    description: str(row["Description"]),
    amenities: parseList(row["Amenities"]),
    images: parseImages(row),
    verified: parseBoolean(row["Verified"]),
    featured: parseBoolean(row["Featured"]),
    status: normalizedStatus,
    contactType: (str(row["Contact Type"]) || "WhatsApp") as Property["contactType"],
    googleMapsUrl: str(row["Google Maps URL"]) || undefined,
    viewCount: parseNumber(row["View Count"], 0),
  };
}

/**
 * Fetches and maps properties from the Google Apps Script Web App. Throws on
 * any failure (network error, non-2xx status, invalid/unsuccessful response
 * shape) so the caller (`getProperties`) can decide to fall back.
 */
async function fetchPropertiesFromSheet(): Promise<Property[]> {
  if (!GOOGLE_APPS_SCRIPT_URL) {
    throw new Error("Missing Google Apps Script URL in config/integrations.ts.");
  }

  const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: "GET",
    // Always hit the live sheet — property data (and view counts) can change
    // at any time and shouldn't be stuck on a stale build-time cache.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Apps Script returned status ${response.status}.`);
  }

  const rawText = await response.text();
  let data: AppsScriptPropertiesResponse;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error("Google Apps Script returned a non-JSON response.");
  }

  if (!data.success) {
    throw new Error(data.error || "Google Apps Script reported failure.");
  }

  if (!Array.isArray(data.properties)) {
    throw new Error("Google Apps Script response did not include a properties array.");
  }

  const mapped = data.properties
    .map(mapSheetRowToProperty)
    .filter((p): p is Property => p !== null);

  if (mapped.length === 0) {
    throw new Error("Google Apps Script returned zero valid properties.");
  }

  return mapped;
}

/**
 * The single entry point every page/route should use to get property data.
 * Wrapped in React's `cache()` so multiple calls within the same request
 * (e.g. a page's generateMetadata + the page component itself) only hit the
 * Google Apps Script endpoint once.
 *
 * - On success: returns ONLY the Google Sheets properties (not merged with
 *   demo data), source: "sheets".
 * - On any failure: returns the hardcoded demo properties, source:
 *   "fallback", so the site remains usable.
 */
export const getProperties = cache(async (): Promise<{
  properties: Property[];
  source: PropertiesSource;
}> => {
  try {
    const sheetProperties = await fetchPropertiesFromSheet();
    return { properties: sheetProperties, source: "sheets" };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[Subphiphat] Falling back to demo property data — Google Sheets fetch failed:",
      error
    );
    return { properties: demoProperties, source: "fallback" };
  }
});

export function findPropertyBySlug(list: Property[], slug: string): Property | undefined {
  return list.find((p) => p.slug === slug);
}

export function findRelatedProperties(
  list: Property[],
  current: Property,
  limit = 3
): Property[] {
  return list
    .filter((p) => p.id !== current.id && p.district === current.district)
    .slice(0, limit)
    .concat(list.filter((p) => p.id !== current.id && p.district !== current.district))
    .slice(0, limit);
}

/**
 * Returns the top `limit` properties by view count (descending), used for
 * the homepage's "Most Viewed" section. Ties are broken by each property's
 * original position in `list` — Array.prototype.sort is stable in modern JS
 * engines (Node 18+/V8), so equal view counts never get randomly reordered.
 */
export function getMostViewedProperties(list: Property[], limit = 6): Property[] {
  return [...list]
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    .slice(0, limit);
}

/**
 * Sends a view-increment request for a single property to our own
 * /api/properties/view route (server-side helper, not used by the browser —
 * the browser calls the API route directly via fetch from a client
 * component). Exported mainly for symmetry/testing; the API route below
 * talks to Apps Script directly.
 */
export async function incrementPropertyView(
  slug: string
): Promise<{ success: boolean; error?: string }> {
  if (!GOOGLE_APPS_SCRIPT_URL) {
    return { success: false, error: "Missing Google Apps Script URL." };
  }

  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "incrementView", slug }),
    });

    const rawText = await response.text();
    let data: { success?: boolean; error?: string } = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }

    if (!response.ok || data.success !== true) {
      return { success: false, error: data.error || "Failed to record view." };
    }

    return { success: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to increment property view:", error);
    return { success: false, error: "Network error while recording view." };
  }
}
