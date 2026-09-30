"use server";

// -----------------------------------------------------------------------------
// AI Property Import — server action
// -----------------------------------------------------------------------------
// V2: text-only. The admin pastes the full listing text (copied from
// Facebook or wherever) plus an OPTIONAL source URL kept purely as
// provenance. There is no URL fetch, no screenshot upload, and no image
// extraction anywhere in this file — the AI receives text only (see
// lib/ai/property-import.ts) and property_images is never touched here.
// Images are added manually by the admin on the edit page afterward, using
// the existing "Add Image by URL" control there.
//
// importProperty() is a small, self-contained insert (deliberately NOT a
// call into ../actions.ts's createProperty(), which always redirect()s and
// so can never hand back the new row's id) — this keeps the entire import
// feature isolated to this directory and the existing manual create/edit
// flow in ../actions.ts completely untouched.
//
// The resulting row is always `status: 'DRAFT'`, hardcoded here — never
// taken from the AI's output, which doesn't even include a status field
// (see lib/ai/property-import.ts's schema). AI can never publish.
// -----------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import {
  extractPropertyFromContent,
  PropertyImportAIError,
  type PropertyExtractionResult,
} from "@/lib/ai/property-import";

export interface ImportActionState {
  error?: string;
}

const VALID_LISTING_TYPES = new Set(["RENT", "BUY"]);
const VALID_PROPERTY_TYPES = new Set([
  "CONDO",
  "APARTMENT",
  "HOUSE",
  "TOWNHOUSE",
  "VILLA",
  "LAND",
  "COMMERCIAL",
  "OTHER",
]);

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function numOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function messageForAIError(error: PropertyImportAIError): string {
  switch (error.code) {
    case "MISSING_CONFIG":
      return "AI property import isn't configured yet. You can create the property manually instead.";
    case "INVALID_OUTPUT":
      return "The AI couldn't extract usable data from that text. Double-check it's pasted in full, or create the property manually.";
    case "REQUEST_FAILED":
    default:
      return "AI extraction failed. Please try again, or create the property manually.";
  }
}

/**
 * Inserts the DRAFT properties row from a validated AI extraction result.
 * Every field the DB requires NOT NULL with no default (listing_type,
 * status, title, slug, property_type, price, province, city) gets an
 * explicit fallback — the SAME defaults components/admin/PropertyForm.tsx's
 * own blank form already uses — when the AI genuinely didn't extract a
 * value, so an under-extracted import opens for review looking like a
 * normal blank-ish draft, never a failed insert. No property_images rows
 * are ever created here — images are added manually after the draft opens.
 */
async function createDraftProperty(params: {
  adminId: string;
  extraction: PropertyExtractionResult;
  sourceUrl: string | null;
}): Promise<{ id: string } | { error: string }> {
  const { adminId, extraction, sourceUrl } = params;
  const supabase = createAdminClient();

  const listingType =
    extraction.listing_type && VALID_LISTING_TYPES.has(extraction.listing_type)
      ? extraction.listing_type
      : "RENT";
  const propertyType =
    extraction.property_type && VALID_PROPERTY_TYPES.has(extraction.property_type)
      ? extraction.property_type
      : "CONDO";
  const title = extraction.title?.trim() || `Imported Property ${randomSuffix()}`;
  const slug = slugify(title) || `imported-property-${randomSuffix()}`;
  const price = typeof extraction.price === "number" && extraction.price >= 0 ? extraction.price : 0;
  const province = extraction.province?.trim() || "Songkhla";
  const city = extraction.city?.trim() || "Hat Yai";

  const privateNotes = extraction.contact_info?.trim()
    ? `Extracted contact info (from source, unverified):\n${extraction.contact_info.trim()}`
    : null;

  const { data, error } = await supabase
    .from("properties")
    .insert({
      listing_type: listingType,
      status: "DRAFT",
      title,
      slug,
      property_type: propertyType,
      description: extraction.description?.trim() || null,
      price,
      province,
      city,
      district: extraction.district?.trim() || null,
      subdistrict: extraction.subdistrict?.trim() || null,
      bedrooms: numOrNull(extraction.bedrooms),
      bathrooms: numOrNull(extraction.bathrooms),
      size_sqm: numOrNull(extraction.size_sqm),
      source: "AI_IMPORT",
      source_url: sourceUrl,
      private_notes: privateNotes,
      created_by: adminId,
      updated_by: adminId,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return {
        error:
          "A property with a very similar title already exists (URL slug collision). Try editing the title once on the review page, or create the property manually instead.",
      };
    }
    return { error: error?.message || "Failed to create the draft property." };
  }

  return { id: data.id as string };
}

/**
 * The only import entry point. `url` is optional and is stored purely as
 * provenance (properties.source_url) plus passed to the AI call as a line
 * of context — it is never fetched, so a Facebook link, an unreachable
 * link, an invalid link, or no link at all all behave identically: the
 * pasted `listing_text` is the sole extraction input. `listing_text` is
 * required.
 */
export async function importProperty(
  _prevState: ImportActionState | null,
  formData: FormData
): Promise<ImportActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const url = String(formData.get("url") || "").trim();
  const listingText = String(formData.get("listing_text") || "").trim();

  if (!listingText) {
    return { error: "Please paste the listing details." };
  }

  let extraction: PropertyExtractionResult;
  try {
    extraction = await extractPropertyFromContent({
      sourceUrl: url || undefined,
      text: listingText,
    });
  } catch (error) {
    if (error instanceof PropertyImportAIError) {
      return { error: messageForAIError(error) };
    }
    return { error: "AI extraction failed unexpectedly. Please try again." };
  }

  const result = await createDraftProperty({
    adminId: admin.id,
    extraction,
    sourceUrl: url || null,
  });

  if ("error" in result) return { error: result.error };

  redirect(`/admin/properties/${result.id}?created=1`);
}
