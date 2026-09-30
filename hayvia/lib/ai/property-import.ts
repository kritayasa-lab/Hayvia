// -----------------------------------------------------------------------------
// AI Property Import — provider layer
// -----------------------------------------------------------------------------
// The ONLY file in the Property CMS that knows anything about a specific AI
// provider/SDK. Everything else (the import server action, the fetch/HTML
// extraction step) calls extractPropertyFromContent() and only ever sees the
// provider-agnostic PropertyExtractionResult shape below — swapping providers
// later means changing this one file, nothing else in app/admin or lib/admin.
//
// One AI call per import (text OR text+screenshot), no multi-agent pipeline,
// no background jobs. Uses the OpenAI SDK already present in package.json.
// -----------------------------------------------------------------------------

import OpenAI from "openai";
import { z } from "zod";

const MODEL = "gpt-4o-mini";
const MAX_TEXT_LENGTH = 12000;

// Deliberately mirrors only the fields explicitly requested. There is no
// "status" or "flood_status" key anywhere in this schema — the AI is never
// even given the option to express either, let alone set them.
const PropertyExtractionSchema = z.object({
  title: z.string().trim().min(1).nullable(),
  description: z.string().trim().min(1).nullable(),
  price: z.number().nonnegative().nullable(),
  listing_type: z.enum(["RENT", "BUY"]).nullable(),
  property_type: z
    .enum(["CONDO", "APARTMENT", "HOUSE", "TOWNHOUSE", "VILLA", "LAND", "COMMERCIAL", "OTHER"])
    .nullable(),
  bedrooms: z.number().int().nonnegative().nullable(),
  bathrooms: z.number().int().nonnegative().nullable(),
  size_sqm: z.number().nonnegative().nullable(),
  province: z.string().trim().min(1).nullable(),
  city: z.string().trim().min(1).nullable(),
  district: z.string().trim().min(1).nullable(),
  subdistrict: z.string().trim().min(1).nullable(),
  amenities: z.array(z.string()).nullable(),
  contact_info: z.string().trim().min(1).nullable(),
});

export type PropertyExtractionResult = z.infer<typeof PropertyExtractionSchema>;

// Exported for verification only (asserting the schema has no status/
// flood_status escape hatch, and that malformed output is rejected) — not
// used by any other application code, which only ever sees
// PropertyExtractionResult via extractPropertyFromContent().
export { PropertyExtractionSchema };

export type PropertyImportAIErrorCode = "MISSING_CONFIG" | "REQUEST_FAILED" | "INVALID_OUTPUT";

export class PropertyImportAIError extends Error {
  constructor(
    message: string,
    public readonly code: PropertyImportAIErrorCode
  ) {
    super(message);
    this.name = "PropertyImportAIError";
  }
}

const SYSTEM_PROMPT = `You are a property-listing data extractor for a real estate company in Thailand. You will be given the visible text of a property listing (fetched from a page, pasted by an admin, or read from a screenshot). Extract ONLY property information that is explicitly present.

Respond with a single JSON object, no markdown, no commentary, matching exactly this shape:
{
  "title": string or null,
  "description": string or null,
  "price": number or null,
  "listing_type": "RENT" or "BUY" or null,
  "property_type": one of "CONDO", "APARTMENT", "HOUSE", "TOWNHOUSE", "VILLA", "LAND", "COMMERCIAL", "OTHER", or null,
  "bedrooms": integer or null,
  "bathrooms": integer or null,
  "size_sqm": number or null,
  "province": string or null,
  "city": string or null,
  "district": string or null,
  "subdistrict": string or null,
  "amenities": array of strings or null,
  "contact_info": string or null
}

Rules:
- If a field is not clearly stated in the content, output null for it. Never guess, infer, or estimate a value that isn't explicitly present.
- Do not include a "status" field under any name — you never decide publish status.
- Do not include any flood-safety/flood-risk field under any name, and never infer flood safety from location, description, or anything else. That is decided by a human, separately, later.
- You are not being asked about images — never mention, generate, or suggest image URLs or image edits.
- "price" must be a plain number (strip currency symbols/commas/words).
- Output valid JSON only.`;

interface ExtractionInput {
  sourceUrl?: string;
  text?: string;
  imageDataUrls?: string[];
}

function buildUserContent(
  input: ExtractionInput
): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

  const header = input.sourceUrl ? `Source URL: ${input.sourceUrl}\n\n` : "";
  const text = (input.text ?? "").slice(0, MAX_TEXT_LENGTH);
  parts.push({
    type: "text",
    text: text
      ? `${header}Listing content:\n${text}`
      : `${header}No readable text was available — extract only from the attached image(s), if any.`,
  });

  for (const dataUrl of input.imageDataUrls ?? []) {
    parts.push({ type: "image_url", image_url: { url: dataUrl } });
  }

  return parts;
}

/**
 * One AI call: takes fetched/pasted text and/or an uploaded screenshot and
 * returns validated, provider-agnostic property fields. Never throws a raw
 * SDK/parse error — always throws PropertyImportAIError with a code the
 * caller can turn into a clear admin-facing message, or returns a value that
 * has already passed schema validation.
 */
export async function extractPropertyFromContent(
  input: ExtractionInput
): Promise<PropertyExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new PropertyImportAIError(
      "AI property import is not configured (missing OPENAI_API_KEY).",
      "MISSING_CONFIG"
    );
  }

  if (!input.text?.trim() && (!input.imageDataUrls || input.imageDataUrls.length === 0)) {
    throw new PropertyImportAIError(
      "Nothing to extract from — provide page text or a screenshot.",
      "REQUEST_FAILED"
    );
  }

  const client = new OpenAI({ apiKey });

  let raw: string | null | undefined;
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserContent(input) },
      ],
    });
    raw = response.choices[0]?.message?.content;
  } catch (error) {
    throw new PropertyImportAIError(
      `AI extraction request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      "REQUEST_FAILED"
    );
  }

  if (!raw) {
    throw new PropertyImportAIError("AI extraction returned an empty response.", "INVALID_OUTPUT");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new PropertyImportAIError("AI extraction did not return valid JSON.", "INVALID_OUTPUT");
  }

  const result = PropertyExtractionSchema.safeParse(parsedJson);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] AI property import: output failed schema validation:", result.error.message);
    throw new PropertyImportAIError(
      "AI extraction returned data in an unexpected shape and was rejected.",
      "INVALID_OUTPUT"
    );
  }

  return result.data;
}
