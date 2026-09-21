"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  // Phase 8C — same pattern, for a Property Radar candidate conversion.
  const radarCandidateId = optionalString(formData, "radar_property_candidate_id");

  const supabase = createAdminClient();

  // Phase 8C — double-conversion protection, checked BEFORE creating
  // anything. Two-part check: the candidate's own status, and (the more
  // authoritative signal) whether a property already links to it — if a
  // property already exists, that's ground truth regardless of what the
  // candidate's status column says. Never creates a second property for an
  // already-converted candidate, including on a double-submit.
  let previousCandidateStatus: string | null = null;
  if (radarCandidateId) {
    const { data: existingCandidate } = await supabase
      .from("radar_property_candidates")
      .select("status")
      .eq("id", radarCandidateId)
      .maybeSingle();

    if (!existingCandidate) {
      return { error: "That Radar candidate could not be found." };
    }
    previousCandidateStatus = existingCandidate.status as string;

    if (existingCandidate.status === "CONVERTED") {
      const { data: existingProperty } = await supabase
        .from("properties")
        .select("id")
        .eq("radar_property_candidate_id", radarCandidateId)
        .maybeSingle();
      if (existingProperty) {
        redirect(`/admin/properties/${existingProperty.id}?alreadyConverted=1`);
      }
      return {
        error:
          "This Radar candidate is already marked as converted, but no linked property could be found. Please check manually.",
      };
    }
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({
      ...buildPropertyRow(formData),
      slug,
      seller_lead_id: sellerLeadId,
      radar_property_candidate_id: radarCandidateId,
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
  // mark the seller lead/Radar candidate CONVERTED on a failed create (see
  // the early returns above). Best-effort: a failure here must never make
  // the property look like it wasn't created, since it demonstrably was.
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

  if (radarCandidateId) {
    const { error: candidateError } = await supabase
      .from("radar_property_candidates")
      .update({ status: "CONVERTED" })
      .eq("id", radarCandidateId);
    if (candidateError) {
      // eslint-disable-next-line no-console
      console.error(
        `[Subphiphat] Property ${data.id} created from Radar candidate ${radarCandidateId}, but marking it CONVERTED failed:`,
        candidateError
      );
    } else {
      const { error: historyError } = await supabase.from("radar_property_status_history").insert({
        candidate_id: radarCandidateId,
        from_status: previousCandidateStatus,
        to_status: "CONVERTED",
        changed_by: admin.id,
        note: `Converted to property ${data.id}`,
      });

      // The redirect below already forces a fresh render of the new
      // property's own page — but the candidate's own detail page (if the
      // browser already had it cached from before conversion) and the
      // Radar list/overview pages would otherwise keep showing the
      // pre-CONVERTED Router Cache entry until it expires.
      revalidatePath(`/admin/radar/properties/${radarCandidateId}`);
      revalidatePath("/admin/radar/properties");
      revalidatePath("/admin/radar");

      if (historyError) {
        // eslint-disable-next-line no-console
        console.error(
          `[Subphiphat] Radar candidate ${radarCandidateId} marked CONVERTED, but its status history row failed:`,
          historyError
        );
      }
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
