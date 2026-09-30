"use server";

// -----------------------------------------------------------------------------
// AI Property Import — server actions
// -----------------------------------------------------------------------------
// Two entry points:
//   - importPropertyFromUrl: the primary path (paste URL -> fetch -> AI).
//   - importPropertyFromManualContent: the fallback path used when the fetch
//     step fails (paste page text and/or up to MAX_SCREENSHOT_COUNT
//     screenshots -> AI, all sent to Gemini together as one extraction).
//     Never a dead end — see components/admin/ImportPropertyForm.tsx for
//     the "Continue to manual property creation" escape hatch shown
//     alongside this form.
//
// Both funnel into createDraftProperty(), a small, self-contained insert
// (deliberately NOT a call into ../actions.ts's createProperty(), which
// always redirect()s and so can never hand back the new row's id for the
// image-insert step that has to happen before this action's own redirect).
// This keeps the entire import feature isolated to this directory and the
// existing manual create/edit flow in ../actions.ts completely untouched.
//
// The resulting row is always `status: 'DRAFT'`, hardcoded here — never
// taken from the AI's output, which doesn't even include a status field
// (see lib/ai/property-import.ts's schema). AI can never publish.
// -----------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import { fetchAndExtractSource } from "@/lib/admin/property-import-fetch";
import {
  extractPropertyFromContent,
  PropertyImportAIError,
  type PropertyExtractionResult,
} from "@/lib/ai/property-import";

export interface ImportActionState {
  error?: string;
  /** true = the admin UI should reveal the paste-text/screenshot/manual fallback. */
  fallback?: boolean;
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

const MAX_SCREENSHOT_COUNT = 10;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024; // per screenshot
const MAX_TOTAL_SCREENSHOT_BYTES = 32 * 1024 * 1024; // combined, keeps the Gemini request body reasonable
const MAX_IMAGES_PER_PROPERTY = 20;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function numOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Inserts the DRAFT properties row (+ property_images rows for whatever
 * image URLs were found) from a validated AI extraction result. Every field
 * the DB requires NOT NULL with no default (listing_type, status, title,
 * slug, property_type, price, province, city) gets an explicit fallback —
 * the SAME defaults components/admin/PropertyForm.tsx's own blank form
 * already uses — when the AI genuinely didn't extract a value, so an
 * under-extracted import opens for review looking like a normal blank-ish
 * draft, never a failed insert.
 */
async function createDraftProperty(params: {
  adminId: string;
  extraction: PropertyExtractionResult;
  sourceUrl: string | null;
  imageUrls: string[];
}): Promise<{ id: string } | { error: string }> {
  const { adminId, extraction, sourceUrl, imageUrls } = params;
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
          "A property with a very similar title already exists (URL slug collision). Try editing the title once on the review page, or use manual creation instead.",
      };
    }
    return { error: error?.message || "Failed to create the draft property." };
  }

  const propertyId = data.id as string;

  if (imageUrls.length > 0) {
    const rows = imageUrls.slice(0, MAX_IMAGES_PER_PROPERTY).map((url, index) => ({
      property_id: propertyId,
      url,
      sort_order: index,
      is_cover: index === 0,
    }));
    const { error: imagesError } = await supabase.from("property_images").insert(rows);
    if (imagesError) {
      // Never fail the whole import over images — the draft itself was
      // created successfully and is the primary deliverable. The admin can
      // add/fix images manually on the edit page exactly as with any other
      // property (same "Add by URL" control already in [id]/page.tsx).
      // eslint-disable-next-line no-console
      console.error(`[Subphiphat] AI import ${propertyId}: failed to save extracted images:`, imagesError);
    }
  }

  return { id: propertyId };
}

function messageForAIError(error: PropertyImportAIError): string {
  switch (error.code) {
    case "MISSING_CONFIG":
      return "AI property import isn't configured yet. You can still continue manually below.";
    case "INVALID_OUTPUT":
      return "The AI couldn't extract usable data from that content. You can try pasting the listing text directly, or continue manually below.";
    case "REQUEST_FAILED":
    default:
      return "AI extraction failed. You can try again, or continue manually below.";
  }
}

/**
 * Primary path: admin pastes a URL. Fetches it server-side (honest request,
 * no anti-bot/login bypass — see lib/admin/property-import-fetch.ts), and on
 * any failure (blocked, login wall, JS-rendered/empty page, network error)
 * returns fallback: true rather than a dead end, so the UI can reveal the
 * paste-text/screenshot/manual-creation options.
 */
export async function importPropertyFromUrl(
  _prevState: ImportActionState | null,
  formData: FormData
): Promise<ImportActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const rawUrl = String(formData.get("url") || "").trim();
  if (!rawUrl) return { error: "Please paste a property URL." };

  const fetched = await fetchAndExtractSource(rawUrl);
  if (!fetched.ok) {
    return { error: fetched.message, fallback: true };
  }

  let extraction: PropertyExtractionResult;
  try {
    extraction = await extractPropertyFromContent({ sourceUrl: rawUrl, text: fetched.text });
  } catch (error) {
    if (error instanceof PropertyImportAIError) {
      return { error: messageForAIError(error), fallback: true };
    }
    return { error: "AI extraction failed unexpectedly. You can continue manually below.", fallback: true };
  }

  const result = await createDraftProperty({
    adminId: admin.id,
    extraction,
    sourceUrl: rawUrl,
    imageUrls: fetched.imageUrls,
  });

  if ("error" in result) return { error: result.error, fallback: true };

  redirect(`/admin/properties/${result.id}?created=1`);
}

/**
 * Fallback path: used when the URL fetch failed. Accepts pasted listing
 * text and/or up to MAX_SCREENSHOT_COUNT uploaded screenshots — e.g. several
 * screenshots of one Facebook post — at least one of the two is required.
 * All screenshots are sent to Gemini together in the SAME extraction call
 * (see buildParts() in lib/ai/property-import.ts, which already loops over
 * every imageDataUrls entry as its own inlineData part) — never one call
 * per screenshot — and the result is still a single structured property
 * object. Screenshots are image input only (multimodal vision request) and
 * are never persisted anywhere (not to Supabase Storage, not to
 * property_images — they're evidence for extraction, not photos of the
 * property, so saving them as property images would be wrong). No image
 * URLs are extracted in this path since there is no page to parse — the
 * admin adds real photos manually on the edit page afterward, same as
 * always.
 */
export async function importPropertyFromManualContent(
  _prevState: ImportActionState | null,
  formData: FormData
): Promise<ImportActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const pastedText = String(formData.get("pasted_text") || "").trim();
  const sourceUrlRaw = String(formData.get("source_url") || "").trim();
  const screenshots = formData
    .getAll("screenshots")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (screenshots.length > MAX_SCREENSHOT_COUNT) {
    return {
      error: `Please upload ${MAX_SCREENSHOT_COUNT} screenshots or fewer (you selected ${screenshots.length}).`,
      fallback: true,
    };
  }

  let imageDataUrls: string[] | undefined;
  if (screenshots.length > 0) {
    const dataUrls: string[] = [];
    let totalBytes = 0;
    for (const screenshot of screenshots) {
      if (!screenshot.type.startsWith("image/")) {
        return { error: `"${screenshot.name}" isn't an image file.`, fallback: true };
      }
      if (screenshot.size > MAX_SCREENSHOT_BYTES) {
        return { error: `"${screenshot.name}" is too large (max 8MB per screenshot).`, fallback: true };
      }
      totalBytes += screenshot.size;
      if (totalBytes > MAX_TOTAL_SCREENSHOT_BYTES) {
        return {
          error: `Screenshots are too large together (max ${MAX_TOTAL_SCREENSHOT_BYTES / (1024 * 1024)}MB combined). Try fewer or smaller screenshots.`,
          fallback: true,
        };
      }
      const buffer = Buffer.from(await screenshot.arrayBuffer());
      dataUrls.push(`data:${screenshot.type};base64,${buffer.toString("base64")}`);
    }
    imageDataUrls = dataUrls;
  }

  if (!pastedText && !imageDataUrls) {
    return { error: "Please paste the listing text or upload at least one screenshot.", fallback: true };
  }

  let extraction: PropertyExtractionResult;
  try {
    extraction = await extractPropertyFromContent({
      sourceUrl: sourceUrlRaw || undefined,
      text: pastedText || undefined,
      imageDataUrls,
    });
  } catch (error) {
    if (error instanceof PropertyImportAIError) {
      return { error: messageForAIError(error), fallback: true };
    }
    return { error: "AI extraction failed unexpectedly. You can continue manually below.", fallback: true };
  }

  const result = await createDraftProperty({
    adminId: admin.id,
    extraction,
    sourceUrl: sourceUrlRaw || null,
    imageUrls: [],
  });

  if ("error" in result) return { error: result.error, fallback: true };

  redirect(`/admin/properties/${result.id}?created=1`);
}
