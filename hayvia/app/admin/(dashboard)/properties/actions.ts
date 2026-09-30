"use server";

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import { backupPropertyToSheets } from "@/lib/admin/sheets-backup";
import { buildStorageObjectKey, validateImageUpload } from "@/lib/admin/property-image-upload";

const PROPERTY_IMAGES_BUCKET = "property-images";

export interface PropertyActionState {
  error?: string;
}

function requireString(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

// A submitted image URL ending in a normal image extension is trusted at
// face value — this is deliberately not a real "is this actually an image"
// check (no fetch, no content-type sniff: AI Property Import never fetches
// anything, and this repo has no image-processing infra to add just for a
// HEAD-request check). It exists only to distinguish an ordinary photo
// link from a bare listing-page link (e.g. a Facebook share URL) for the
// guard below. .pathname is already query-string/fragment-free.
const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i;

function looksLikeImageUrl(url: string): boolean {
  try {
    return IMAGE_EXTENSION_PATTERN.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Best-effort Supabase -> Sheets backup after an admin create/edit. Never
 * throws (backupPropertyToSheets already catches everything internally and
 * logs to backup_logs) and its outcome never affects whether the admin's
 * save is reported as successful — awaited only so the attempt actually
 * completes before this serverless function returns, not to gate on it.
 * Returns "success" | "pending" (never lets a backup failure look like a
 * save failure) so the caller can tell the admin which one happened —
 * "Saved to Supabase. Google Sheets backup pending." vs "Backed up to
 * Google Sheets." — without ever implying the property itself failed to save.
 */
async function backupNewPropertyToSheets(propertyId: string): Promise<"success" | "pending"> {
  try {
    const result = await backupPropertyToSheets(propertyId);
    return result.success ? "success" : "pending";
  } catch {
    // backupPropertyToSheets shouldn't throw, but this is defense in depth —
    // a backup failure must never surface as a property-save failure.
    return "pending";
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
    flood_status: requireString(formData, "flood_status") || "UNKNOWN",
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

  // Phase 7 — set only at creation time from PropertyForm's own hidden
  // field (see components/admin/PropertyForm.tsx), never part of
  // buildPropertyRow(), so an edit-form resubmission can never alter an
  // existing property's traceability link.
  const sellerLeadId = optionalString(formData, "seller_lead_id");

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("properties")
    .insert({
      ...buildPropertyRow(formData),
      slug,
      seller_lead_id: sellerLeadId,
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

  // Only after the property has actually been created successfully — never
  // mark the seller lead CONVERTED on a failed create (see the early
  // returns above). Best-effort: a failure here must never make the
  // property look like it wasn't created, since it demonstrably was.
  if (sellerLeadId) {
    const { error: sellerLeadError } = await supabase
      .from("seller_leads")
      .update({ status: "CONVERTED" })
      .eq("id", sellerLeadId);
    if (sellerLeadError) {
      // eslint-disable-next-line no-console
      console.error(
        `[Subphiphat] Property ${data.id} created from seller lead ${sellerLeadId}, but marking it CONVERTED failed:`,
        sellerLeadError
      );
    }
  }

  const backupStatus = await backupNewPropertyToSheets(data.id);

  redirect(`/admin/properties/${data.id}?created=1&backup=${backupStatus}`);
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

  const backupStatus = await backupNewPropertyToSheets(id);

  redirect(`/admin/properties/${id}?saved=1&backup=${backupStatus}`);
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

  // Guards against the exact bug seen in Production: an AI-imported
  // property's `source_url` (the listing page itself — e.g. a Facebook
  // share link, never an image) is visible in the "Source URL" field on
  // this same edit page and was mistakenly pasted here too, which this
  // form had no way to catch. Only blocks an EXACT match with no
  // recognizable image extension — a source_url that genuinely is a direct
  // image link is still allowed through.
  const { data: property } = await supabase
    .from("properties")
    .select("source_url")
    .eq("id", propertyId)
    .maybeSingle();
  if (property?.source_url && url === property.source_url && !looksLikeImageUrl(url)) {
    redirect(`/admin/properties/${propertyId}?imageError=source_url`);
  }

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

export interface UploadImageResult {
  success: boolean;
  error?: string;
  image?: { id: string; url: string; is_cover: boolean };
}

/**
 * Uploads ONE original image file to Storage and records it as an ordinary
 * property_images row — same cover-assignment rule as addPropertyImage()
 * above (first image for this property becomes cover, an existing cover is
 * never replaced automatically). Called directly (not via <form action>)
 * from components/admin/PropertyImageUpload.tsx, once per selected file,
 * so the client can show per-file progress and reveal each thumbnail as
 * its own upload finishes — returns a result object instead of redirecting.
 *
 * No resizing/compression/format conversion: the uploaded bytes are stored
 * exactly as received. Content type is never trusted from the client —
 * validateImageUpload() sniffs the real file signature.
 */
export async function uploadPropertyImage(
  propertyId: string,
  formData: FormData
): Promise<UploadImageResult> {
  const admin = await getAdminUser();
  if (!admin) return { success: false, error: "Not authorized." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file provided." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateImageUpload(file.name, file.size, buffer);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  const supabase = createAdminClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) {
    return { success: false, error: "Property not found." };
  }

  const objectKey = buildStorageObjectKey(propertyId, file.name, validation.mimeType, crypto.randomUUID());

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .upload(objectKey, buffer, { contentType: validation.mimeType, upsert: false });
  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROPERTY_IMAGES_BUCKET).getPublicUrl(objectKey);

  const { count } = await supabase
    .from("property_images")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  const { data: inserted, error: insertError } = await supabase
    .from("property_images")
    .insert({
      property_id: propertyId,
      url: publicUrl,
      sort_order: count ?? 0,
      is_cover: (count ?? 0) === 0, // first image uploaded becomes the cover automatically
    })
    .select("id, url, is_cover")
    .single();

  if (insertError || !inserted) {
    // The row failed to save — remove the now-orphaned Storage object
    // rather than leaving a file with nothing pointing to it.
    await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove([objectKey]);
    return { success: false, error: insertError?.message || "Failed to save the uploaded image." };
  }

  return { success: true, image: inserted };
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
