import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getListingType, type Property } from "@/data/properties";

// -----------------------------------------------------------------------------
// Bridges a Property object (Sheets- or demo-data-shaped — see
// lib/properties-source.ts) into Supabase's `properties` table, by upserting
// on `external_ref`. Supabase is the source of truth for the live site, so
// in normal operation every property a visitor can see already has a real
// Supabase row (property.supabaseId is set) and this function is never
// called for it — see app/api/inquiries/route.ts, app/api/viewings/route.ts,
// and lib/matching/persist.ts, which all use property.supabaseId directly
// when present. This function is only actually invoked in two cases:
//   1. The demo-data fallback (Supabase is unreachable/empty — see
//      getProperties() in lib/properties-source.ts): a guest inquiry/
//      viewing/match against a demo property still needs a real Supabase
//      row to attach its foreign key to.
//   2. lib/admin/legacy-sheets-import.ts, the manual/one-off Sheets ->
//      Supabase migration tool — calls this once per Sheet row so that path
//      and the guest-sync path above can never drift on what "syncing a
//      property" means.
//
// This upserts by `external_ref` (the property's Sheets/demo id, e.g. "p1" or
// a Sheet row's ID) — the exact bridging key DATABASE_SCHEMA.md documents for
// this purpose. Running this repeatedly for the same property updates the
// existing row rather than creating duplicates.
//
// IMPORTANT — what does NOT get overwritten on an update: owner_id, agent_id,
// source, source_url, commission_type, commission_value, private_notes, and
// price_reduced are admin-only fields with no Sheet/demo-data equivalent.
// They're set to their defaults (null / false) on first INSERT only, and are
// never included in the UPDATE payload, so an admin's edits to any of them
// can never be silently reset by a later sync — this is what Phase A's "do
// not overwrite private/admin fields accidentally with blank Sheet values"
// requirement means in practice.
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

const statusMap: Record<Property["status"], string> = {
  available: "PUBLISHED",
  reserved: "RESERVED",
  rented: "RENTED",
};

/**
 * Fields that are safe to write on every sync, whether the row is being
 * inserted for the first time or updated — i.e. everything that genuinely
 * comes from Sheets/demo data. Deliberately excludes owner_id, agent_id,
 * source, source_url, commission_type, commission_value, private_notes,
 * price_reduced — see the file-level comment above.
 */
function buildSyncableRow(property: Property) {
  return {
    external_ref: property.id,
    listing_type: getListingType(property) === "sale" ? "BUY" : "RENT",
    status: statusMap[property.status] ?? "PUBLISHED",
    title: property.title,
    slug: property.slug,
    property_type: propertyTypeMap[property.propertyType],
    description: property.description || null,
    price: property.price,
    currency: "THB",
    rental_period: getListingType(property) === "sale" ? null : "MONTHLY",
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
    location: property.location || null,
    google_maps_url: property.googleMapsUrl || null,
    contact_type: property.contactType || null,
    verified: property.verified,
    featured: property.featured,
    view_count: property.viewCount ?? 0,
  };
}

/**
 * Upserts the given property into Supabase's `properties` table (service
 * role — this table has no anon/authenticated write access, by design),
 * plus its images and amenities, and returns its Supabase uuid. Safe to call
 * repeatedly for the same property — idempotent by `external_ref`.
 */
export async function syncPropertyToSupabase(property: Property): Promise<string> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("properties")
    .select("id")
    .eq("external_ref", property.id)
    .maybeSingle();

  const syncableRow = buildSyncableRow(property);
  let propertyId: string;

  if (existing) {
    const { error } = await supabase.from("properties").update(syncableRow).eq("id", existing.id);
    if (error) {
      throw new Error(`Failed to update property "${property.slug}" in Supabase: ${error.message}`);
    }
    propertyId = existing.id as string;
  } else {
    const { data, error } = await supabase
      .from("properties")
      .insert({ ...syncableRow, price_reduced: false })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(
        `Failed to create property "${property.slug}" in Supabase: ${error?.message ?? "unknown error"}`
      );
    }
    propertyId = data.id as string;
  }

  await syncPropertyImages(propertyId, property.images);
  await syncPropertyAmenities(propertyId, property.amenities);

  return propertyId;
}

/**
 * Replaces every property_images row for this property with the Sheet/demo
 * data's current image list, in order, first image as cover. Delete-then-
 * reinsert is safe here specifically because this function is only ever
 * called for Sheet/demo-sourced properties — admin-created properties (see
 * app/admin/(dashboard)/properties/actions.ts) manage their own images
 * directly and never go through this function, so there's no risk of
 * clobbering an admin's manually-curated image set.
 */
async function syncPropertyImages(propertyId: string, images: string[]) {
  const supabase = createAdminClient();
  await supabase.from("property_images").delete().eq("property_id", propertyId);

  if (images.length === 0) return;

  const rows = images.map((url, index) => ({
    property_id: propertyId,
    url,
    sort_order: index,
    is_cover: index === 0,
  }));

  const { error } = await supabase.from("property_images").insert(rows);
  if (error) {
    throw new Error(`Failed to sync images for property ${propertyId}: ${error.message}`);
  }
}

/**
 * Replaces every property_amenities link for this property with the Sheet/
 * demo data's current amenity list, finding-or-creating each amenity by name
 * in the shared `amenities` lookup table. Same delete-then-reinsert safety
 * reasoning as syncPropertyImages above.
 */
async function syncPropertyAmenities(propertyId: string, amenityNames: string[]) {
  const supabase = createAdminClient();
  await supabase.from("property_amenities").delete().eq("property_id", propertyId);

  const uniqueNames = [...new Set(amenityNames.map((name) => name.trim()).filter(Boolean))];
  if (uniqueNames.length === 0) return;

  const amenityIds: string[] = [];
  for (const name of uniqueNames) {
    const { data: existing } = await supabase
      .from("amenities")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      amenityIds.push(existing.id as string);
      continue;
    }

    const { data: created, error } = await supabase
      .from("amenities")
      .insert({ name })
      .select("id")
      .single();
    if (error || !created) {
      // A concurrent sync may have created the same amenity name between our
      // check and insert (unique constraint) — re-fetch instead of failing
      // the whole sync over a benign race.
      const { data: retried } = await supabase
        .from("amenities")
        .select("id")
        .eq("name", name)
        .maybeSingle();
      if (retried) {
        amenityIds.push(retried.id as string);
      }
      continue;
    }
    amenityIds.push(created.id as string);
  }

  if (amenityIds.length === 0) return;

  const { error } = await supabase
    .from("property_amenities")
    .insert(amenityIds.map((amenityId) => ({ property_id: propertyId, amenity_id: amenityId })));
  if (error) {
    throw new Error(`Failed to sync amenities for property ${propertyId}: ${error.message}`);
  }
}
