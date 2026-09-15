"use server";

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import { backupPropertyToSheets } from "@/lib/admin/sheets-backup";

export interface PropertyActionState {
  error?: string;
}

function requireString(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

/**
 * Best-effort Supabase -> Sheets backup after an admin create/edit. Never
 * throws (backupPropertyToSheets already catches everything internally and
 * logs to backup_logs) and its outcome never affects whether the admin's
 * save is reported as successful — awaited only so the attempt actually
 * completes before this serverless function returns, not to gate on it.
 */
async function backupNewPropertyToSheets(propertyId: string) {
  try {
    await backupPropertyToSheets(propertyId);
  } catch {
    // backupPropertyToSheets shouldn't throw, but this is defense in depth —
    // a backup failure must never surface as a property-save failure.
  }
}

function optionalString(formData: FormData, key: string): string | null {
  const value = requireString(formData, key);
  return value || null;
}

function optionalNumber(formData: FormData, key: string): number | null {
  const value = requireString(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds the shared property row payload from a submitted form — used by
 * both create and update so the two can never drift out of sync on which
 * fields are editable.
 */
function buildPropertyRow(formData: FormData) {
  const listingType = requireString(formData, "listing_type") || "RENT";
  return {
    listing_type: listingType,
    status: requireString(formData, "status") || "DRAFT",
    title: requireString(formData, "title"),
    property_type: requireString(formData, "property_type") || "CONDO",
    description: optionalString(formData, "description"),
    price: optionalNumber(formData, "price") ?? 0,
    currency: requireString(formData, "currency") || "THB",
    rental_period: listingType === "RENT" ? optionalString(formData, "rental_period") : null,
    bedrooms: optionalNumber(formData, "bedrooms"),
    bathrooms: optionalNumber(formData, "bathrooms"),
    size_sqm: optionalNumber(formData, "size_sqm"),
    furnished: optionalString(formData, "furnished"),
    parking: formData.get("parking") === "on",
    wifi: formData.get("wifi") === "on",
    available_date: optionalString(formData, "available_date"),
    minimum_rental: optionalString(formData, "minimum_rental"),
    deposit: optionalString(formData, "deposit"),
    country: requireString(formData, "country") || "Thailand",
    province: requireString(formData, "province"),
    city: requireString(formData, "city"),
    district: optionalString(formData, "district"),
    subdistrict: optionalString(formData, "subdistrict"),
    google_maps_url: optionalString(formData, "google_maps_url"),
    verified: formData.get("verified") === "on",
    featured: formData.get("featured") === "on",
    price_reduced: formData.get("price_reduced") === "on",
    owner_id: optionalString(formData, "owner_id"),
    agent_id: optionalString(formData, "agent_id"),
    source: optionalString(formData, "source"),
    source_url: optionalString(formData, "source_url"),
    commission_type: optionalString(formData, "commission_type"),
    commission_value: optionalNumber(formData, "commission_value"),
    private_notes: optionalString(formData, "private_notes"),
  };
}

export async function createProperty(
  _prevState: PropertyActionState | null,
  formData: FormData
): Promise<PropertyActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const title = requireString(formData, "title");
  const province = requireString(formData, "province");
  const city = requireString(formData, "city");
  if (!title) return { error: "Please enter a property title." };
  if (!province || !city) return { error: "Please enter a province and city." };

  const rawSlug = requireString(formData, "slug");
  const slug = slugify(rawSlug || title);
  if (!slug) return { error: "Could not generate a URL slug from that title." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({
      ...buildPropertyRow(formData),
      slug,
      created_by: admin.id,
      updated_by: admin.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { error: "A property with that URL slug already exists. Please choose another." };
    }
    return { error: error?.message || "Failed to create property." };
  }

  await backupNewPropertyToSheets(data.id);

  redirect(`/admin/properties/${data.id}?created=1`);
}

export async function updateProperty(
  id: string,
  _prevState: PropertyActionState | null,
  formData: FormData
): Promise<PropertyActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const title = requireString(formData, "title");
  const province = requireString(formData, "province");
  const city = requireString(formData, "city");
  if (!title) return { error: "Please enter a property title." };
  if (!province || !city) return { error: "Please enter a province and city." };

  const rawSlug = requireString(formData, "slug");
  const slug = slugify(rawSlug || title);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("properties")
    .update({
      ...buildPropertyRow(formData),
      slug,
      updated_by: admin.id,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A property with that URL slug already exists. Please choose another." };
    }
    return { error: error.message || "Failed to save changes." };
  }

  await backupNewPropertyToSheets(id);

  redirect(`/admin/properties/${id}?saved=1`);
}

// -----------------------------------------------------------------------
// Images
// -----------------------------------------------------------------------

// Plain form action (no useFormState wrapper — see the "Add Image" form in
// the [id] edit page), so this takes just (propertyId, formData), matching
// the native <form action> signature React expects once propertyId is
// bound. Validation failures redirect back with a query flag rather than
// returning rich error state, since this is a small inline add-by-URL
// control, not a full form with its own error UI.
export async function addPropertyImage(propertyId: string, formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const url = requireString(formData, "url");
  if (!url) redirect(`/admin/properties/${propertyId}?imageError=1`);

  const supabase = createAdminClient();

  const { count } = await supabase
    .from("property_images")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  const { error } = await supabase.from("property_images").insert({
    property_id: propertyId,
    url,
    sort_order: count ?? 0,
    is_cover: (count ?? 0) === 0, // first image uploaded becomes the cover automatically
  });

  if (error) redirect(`/admin/properties/${propertyId}?imageError=1`);

  redirect(`/admin/properties/${propertyId}?imageAdded=1`);
}

export async function removePropertyImage(imageId: string, propertyId: string) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  await supabase.from("property_images").delete().eq("id", imageId);
  redirect(`/admin/properties/${propertyId}`);
}

export async function setCoverImage(imageId: string, propertyId: string) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  // Only one row may have is_cover = true (partial unique index) — clear the
  // old cover first so the two updates never collide.
  await supabase.from("property_images").update({ is_cover: false }).eq("property_id", propertyId);
  await supabase.from("property_images").update({ is_cover: true }).eq("id", imageId);
  redirect(`/admin/properties/${propertyId}`);
}

export async function moveImage(
  propertyId: string,
  imageId: string,
  direction: "up" | "down"
) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  const { data: images } = await supabase
    .from("property_images")
    .select("id, sort_order")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });

  if (!images) redirect(`/admin/properties/${propertyId}`);

  const index = images.findIndex((img) => img.id === imageId);
  const swapWith = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || swapWith < 0 || swapWith >= images.length) {
    redirect(`/admin/properties/${propertyId}`);
  }

  const a = images[index];
  const b = images[swapWith];
  await supabase.from("property_images").update({ sort_order: b.sort_order }).eq("id", a.id);
  await supabase.from("property_images").update({ sort_order: a.sort_order }).eq("id", b.id);

  redirect(`/admin/properties/${propertyId}`);
}

// -----------------------------------------------------------------------
// Amenities
// -----------------------------------------------------------------------

export async function toggleAmenity(propertyId: string, amenityId: string, enable: boolean) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  if (enable) {
    await supabase.from("property_amenities").insert({ property_id: propertyId, amenity_id: amenityId });
  } else {
    await supabase
      .from("property_amenities")
      .delete()
      .eq("property_id", propertyId)
      .eq("amenity_id", amenityId);
  }
  redirect(`/admin/properties/${propertyId}`);
}
