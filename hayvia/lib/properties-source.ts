// -----------------------------------------------------------------------------
// Property data source
// -----------------------------------------------------------------------------
// PHASE A: Supabase is now the SOURCE OF TRUTH (see supabase/DATABASE_SCHEMA.md
// and the Phase A audit report). Read order:
//
//   1. Supabase `public_properties` (+ property_images, property_amenities) —
//      via the anon-key client (lib/supabase/server.ts), which respects RLS.
//      Used whenever this returns at least one property.
//   2. The "HAYVIA — Properties" Google Sheet, via the existing Google Apps
//      Script Web App (config/integrations.ts) — used only when Supabase has
//      zero properties (e.g. the bulk import hasn't been run yet). This is
//      the ORIGINAL primary source from before Phase A, kept exactly as-is,
//      purely as a fallback now.
//   3. The hardcoded demo data in data/properties.ts — used only if both of
//      the above fail or are empty, so the site never shows a broken page.
//
// This three-way fallback is intentionally isolated to `getProperties()`
// below — every caller (Server Components, app/api/properties/route.ts,
// the matching engine) is unaffected by which source actually served a
// given request.
// -----------------------------------------------------------------------------

import { cache } from "react";
import { GOOGLE_APPS_SCRIPT_URL } from "@/config/integrations";
import {
  properties as demoProperties,
  type Property,
} from "@/data/properties";
import { slugify } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export type PropertiesSource = "supabase" | "sheets" | "fallback";

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
    // No "Listing Type" column exists in the live sheet yet — this reads it
    // defensively so today it always resolves to undefined (→ "rent" via
    // getListingType) and nothing changes, but a sale row can be added to
    // the sheet later without any code changes here.
    listingType: str(row["Listing Type"]).toLowerCase() === "sale" ? "sale" : undefined,
  };
}

/**
 * Fetches and maps properties from the Google Apps Script Web App. Throws on
 * any failure (network error, non-2xx status, invalid/unsuccessful response
 * shape) so callers can decide to fall back. Exported (not just used via
 * `getProperties()`) for lib/admin/sheets-import.ts, which needs the REAL
 * Sheet data specifically — importing the demo-data fallback into Supabase
 * as if it were real inventory would be wrong, so the importer must see a
 * genuine failure here rather than a silently-substituted fallback.
 */
export async function fetchPropertiesFromSheet(): Promise<Property[]> {
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

const supabasePropertyTypeMap: Record<string, Property["propertyType"]> = {
  CONDO: "Condo",
  APARTMENT: "Apartment",
  HOUSE: "House",
  TOWNHOUSE: "Townhouse",
  // VILLA/LAND/COMMERCIAL/OTHER have no equivalent in the app's current
  // 4-value PropertyType union (a pre-existing constraint, not introduced by
  // Phase A) — falls back to "Condo" the same way the Sheets mapper already
  // falls back to a default for an unrecognized value, rather than crashing.
  // Flagged as a known limitation: extending PropertyType to cover these is
  // out of scope for a data-foundation pass.
};

const supabaseFurnishedMap: Record<string, Property["furnished"]> = {
  FULLY_FURNISHED: "Fully furnished",
  PARTIALLY_FURNISHED: "Partially furnished",
  UNFURNISHED: "Unfurnished",
};

const supabaseStatusMap: Record<string, Property["status"]> = {
  PUBLISHED: "available",
  RESERVED: "reserved",
  RENTED: "rented",
};

interface SupabasePropertyRow {
  id: string;
  external_ref: string | null;
  listing_type: string;
  status: string;
  title: string;
  slug: string;
  property_type: string;
  description: string | null;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  furnished: string | null;
  parking: boolean;
  wifi: boolean;
  available_date: string | null;
  minimum_rental: string | null;
  deposit: string | null;
  district: string | null;
  location: string | null;
  google_maps_url: string | null;
  contact_type: string | null;
  verified: boolean;
  featured: boolean;
  view_count: number;
}

function mapSupabaseRowToProperty(
  row: SupabasePropertyRow,
  images: string[],
  amenities: string[]
): Property {
  return {
    id: row.external_ref || row.id,
    supabaseId: row.id,
    slug: row.slug,
    title: row.title,
    location: row.location || row.district || "Hat Yai",
    district: (row.district || "Central Hat Yai") as Property["district"],
    price: row.price,
    propertyType: supabasePropertyTypeMap[row.property_type] ?? "Condo",
    bedrooms: row.bedrooms ?? 0,
    bathrooms: row.bathrooms ?? 1,
    size: row.size_sqm ?? 0,
    furnished: (row.furnished && supabaseFurnishedMap[row.furnished]) || "Unfurnished",
    parking: row.parking,
    wifi: row.wifi,
    availableDate: row.available_date || "",
    minimumLease: row.minimum_rental || "",
    deposit: row.deposit || "",
    description: row.description || "",
    amenities,
    images: images.length > 0 ? images : ["/images/hero-living-room.jpg"],
    verified: row.verified,
    featured: row.featured,
    status: supabaseStatusMap[row.status] ?? "available",
    contactType: (row.contact_type as Property["contactType"]) || "WhatsApp",
    googleMapsUrl: row.google_maps_url || undefined,
    viewCount: row.view_count,
    listingType: row.listing_type === "BUY" ? "sale" : "rent",
  };
}

/**
 * Reads every publicly-visible property directly from Supabase
 * (public_properties + property_images + property_amenities, via the
 * anon-key client — never service-role). Returns an empty array (not a
 * throw) on any failure or when there simply are no properties yet, so
 * `getProperties()` below can fall through to Sheets cleanly either way.
 */
async function fetchPropertiesFromSupabase(): Promise<Property[]> {
  try {
    const supabase = createClient();
    const { data: rows, error } = await supabase.from("public_properties").select("*");

    if (error || !rows || rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const [{ data: imageRows }, { data: amenityRows }] = await Promise.all([
      supabase
        .from("property_images")
        .select("property_id, url, sort_order")
        .in("property_id", ids)
        .order("sort_order", { ascending: true }),
      supabase.from("property_amenities").select("property_id, amenities(name)").in("property_id", ids),
    ]);

    const imagesByProperty = new Map<string, string[]>();
    for (const image of imageRows ?? []) {
      const list = imagesByProperty.get(image.property_id) ?? [];
      list.push(image.url);
      imagesByProperty.set(image.property_id, list);
    }

    const amenitiesByProperty = new Map<string, string[]>();
    for (const link of amenityRows ?? []) {
      const name = (link.amenities as unknown as { name?: string } | null)?.name;
      if (!name) continue;
      const list = amenitiesByProperty.get(link.property_id) ?? [];
      list.push(name);
      amenitiesByProperty.set(link.property_id, list);
    }

    return rows.map((row) =>
      mapSupabaseRowToProperty(
        row as SupabasePropertyRow,
        imagesByProperty.get(row.id) ?? [],
        amenitiesByProperty.get(row.id) ?? []
      )
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to read properties from Supabase:", error);
    return [];
  }
}

/**
 * The single entry point every page/route should use to get property data.
 * Wrapped in React's `cache()` so multiple calls within the same request
 * (e.g. a page's generateMetadata + the page component itself) only hit the
 * same source once.
 *
 * Phase A read order:
 *   1. Supabase — source: "supabase" — used whenever it returns at least one
 *      property. This is now the source of truth.
 *   2. Google Sheets — source: "sheets" — used only when Supabase has none
 *      (e.g. the bulk import hasn't been run yet on this project).
 *   3. Hardcoded demo data — source: "fallback" — used only if both of the
 *      above fail or are empty, so the site never shows a broken page.
 */
export const getProperties = cache(async (): Promise<{
  properties: Property[];
  source: PropertiesSource;
}> => {
  const supabaseProperties = await fetchPropertiesFromSupabase();
  if (supabaseProperties.length > 0) {
    return { properties: supabaseProperties, source: "supabase" };
  }

  try {
    const sheetProperties = await fetchPropertiesFromSheet();
    return { properties: sheetProperties, source: "sheets" };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[Subphiphat] Falling back to demo property data — Supabase is empty and Google Sheets fetch failed:",
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
 * Returns the `limit` properties with the soonest `availableDate` (i.e. the
 * newest listings coming onto the market), used for the homepage's "Latest
 * Listings" section. Properties whose id is in `excludeIds` are skipped so
 * this section doesn't just repeat whatever "Featured" already showed.
 */
export function getLatestProperties(
  list: Property[],
  excludeIds: string[] = [],
  limit = 6
): Property[] {
  const exclude = new Set(excludeIds);
  return [...list]
    .filter((p) => !exclude.has(p.id))
    .sort((a, b) => new Date(b.availableDate).getTime() - new Date(a.availableDate).getTime())
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
