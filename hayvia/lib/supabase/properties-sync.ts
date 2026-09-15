import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getListingType, type Property } from "@/data/properties";

// -----------------------------------------------------------------------------
// Bridges the app's real, currently-displayed property data (Google Sheets or
// the demo fallback — see lib/properties-source.ts) into Supabase's
// `properties` table, which is otherwise empty until Phase 4's full data
// migration runs. inquiries/viewings/matching_results all have NOT NULL uuid
// foreign keys to properties.id, so before any of those can be written, the
// specific property being inquired/viewed/matched-to needs a real row here.
//
// This upserts by `external_ref` (the property's Sheets/demo id, e.g. "p1" or
// a Sheet row's ID) — the exact bridging key DATABASE_SCHEMA.md documents for
// this purpose ("so the Phase 4 import script can upsert idempotently").
// Running this repeatedly for the same property updates the existing row
// rather than creating duplicates. Only real, currently-live property data is
// written — nothing here is invented.
// -----------------------------------------------------------------------------

export const propertyTypeMap: Record<Property["propertyType"], string> = {
  Condo: "CONDO",
  Apartment: "APARTMENT",
  House: "HOUSE",
  Townhouse: "TOWNHOUSE",
};

export const furnishedMap: Record<Property["furnished"], string> = {
  "Fully furnished": "FULLY_FURNISHED",
  "Partially furnished": "PARTIALLY_FURNISHED",
  Unfurnished: "UNFURNISHED",
};

/**
 * Upserts the given property into Supabase's `properties` table (service
 * role — this table has no anon/authenticated write access, by design) and
 * returns its Supabase uuid. Safe to call repeatedly for the same property.
 */
export async function syncPropertyToSupabase(property: Property): Promise<string> {
  const supabase = createAdminClient();

  const row = {
    external_ref: property.id,
    listing_type: getListingType(property) === "sale" ? "BUY" : "RENT",
    status: "PUBLISHED",
    title: property.title,
    slug: property.slug,
    property_type: propertyTypeMap[property.propertyType],
    description: property.description || null,
    price: property.price,
    currency: "THB",
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    size_sqm: property.size,
    furnished: furnishedMap[property.furnished],
    parking: property.parking,
    wifi: property.wifi,
    available_date: property.availableDate ? property.availableDate.slice(0, 10) : null,
    minimum_rental: property.minimumLease || null,
    deposit: property.deposit || null,
    country: "Thailand",
    province: "Songkhla",
    city: "Hat Yai",
    district: property.district,
    google_maps_url: property.googleMapsUrl || null,
    verified: property.verified,
    featured: property.featured,
    view_count: property.viewCount ?? 0,
  };

  const { data, error } = await supabase
    .from("properties")
    .upsert(row, { onConflict: "external_ref" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to sync property "${property.slug}" to Supabase: ${error?.message ?? "unknown error"}`
    );
  }

  return data.id as string;
}
