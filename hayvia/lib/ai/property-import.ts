// -----------------------------------------------------------------------------
// AI Property Import — provider layer
// -----------------------------------------------------------------------------
// The ONLY file in the Property CMS that knows anything about a specific AI
// provider. Everything else (the import server action) calls
// extractPropertyFromContent() and only ever sees the provider-agnostic
// PropertyExtractionResult shape below — swapping providers means changing
// this one file, nothing else in app/admin. Google Gemini
// (gemini-3.5-flash-lite), via a plain REST call (no SDK dependency), one
// provider, one call per import.
//
// TEXT ONLY. Property Import V1 reads the admin's pasted listing text —
// there is no image/screenshot input anywhere in this file. A pasted
// source URL is stored only as provenance by the caller and is never sent
// to this function at all.
// -----------------------------------------------------------------------------

import { z } from "zod";

const MODEL = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_TEXT_LENGTH = 12000;
const REQUEST_TIMEOUT_MS = 30000;

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
// flood_status/coordinate escape hatch, and that malformed output is
// rejected) — not used by any other application code, which only ever sees
// PropertyExtractionResult via extractPropertyFromContent().
export { PropertyExtractionSchema };

// Gemini's structured-output schema is an OpenAPI 3.0 subset, not JSON
// Schema — uppercase type names, "nullable" instead of a union/optional,
// and (per Gemini's requirement for reliable nullable structured output)
// every property listed in `required` so the model must emit an explicit
// null rather than silently omit a field it didn't find.
const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", nullable: true },
    description: { type: "STRING", nullable: true },
    price: { type: "NUMBER", nullable: true },
    listing_type: { type: "STRING", enum: ["RENT", "BUY"], nullable: true },
    property_type: {
      type: "STRING",
      enum: ["CONDO", "APARTMENT", "HOUSE", "TOWNHOUSE", "VILLA", "LAND", "COMMERCIAL", "OTHER"],
      nullable: true,
    },
    bedrooms: { type: "INTEGER", nullable: true },
    bathrooms: { type: "INTEGER", nullable: true },
    size_sqm: { type: "NUMBER", nullable: true },
    province: { type: "STRING", nullable: true },
    city: { type: "STRING", nullable: true },
    district: { type: "STRING", nullable: true },
    subdistrict: { type: "STRING", nullable: true },
    amenities: { type: "ARRAY", items: { type: "STRING" }, nullable: true },
    contact_info: { type: "STRING", nullable: true },
  },
  required: [
    "title",
    "description",
    "price",
    "listing_type",
    "property_type",
    "bedrooms",
    "bathrooms",
    "size_sqm",
    "province",
    "city",
    "district",
    "subdistrict",
    "amenities",
    "contact_info",
  ],
} as const;

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

const SYSTEM_INSTRUCTION = `You are a property-listing data extractor for a real estate company in Thailand. You will be given the full text of a property listing, pasted by an admin (often copied from a Facebook post or other listing site). Extract ONLY property information that is explicitly present, matching the provided response schema exactly.

Rules:
- If a field is not clearly stated in the content, output null for it. Never guess, infer, or estimate a value that isn't explicitly present.
- Do not include a "status" field under any name — you never decide publish status.
- Do not include any flood-safety/flood-risk field under any name, and never infer flood safety from location, description, or anything else. That is decided by a human, separately, later.
- Do not include or infer any latitude/longitude/coordinates field under any name.
- You are not being asked about images — never mention, generate, or suggest image URLs or image edits.
- "price" must be a plain number (strip currency symbols/commas/words — e.g. "3.29 ล้านบาท" is 3290000).`;

interface ExtractionInput {
  sourceUrl?: string;
  text: string;
}

function buildContents(input: ExtractionInput): { role: string; parts: Array<{ text: string }> } {
  const header = input.sourceUrl ? `Source URL (provenance only, not part of the listing): ${input.sourceUrl}\n\n` : "";
  const text = input.text.slice(0, MAX_TEXT_LENGTH);
  return {
    role: "user",
    parts: [{ text: `${header}Listing text:\n${text}` }],
  };
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

/**
 * One AI call: takes the admin's pasted listing text (and, purely as
 * provenance context in the prompt, an optional source URL — never
 * fetched, never itself extracted from) and returns a single validated,
 * provider-agnostic property object. Never throws a raw fetch/parse error
 * — always throws PropertyImportAIError with a code the caller can turn
 * into a clear admin-facing message, or returns a value that has already
 * passed schema validation. The request has a hard timeout
 * (REQUEST_TIMEOUT_MS) so the caller's UI can never be stuck waiting
 * indefinitely.
 */
export async function extractPropertyFromContent(
  input: ExtractionInput
): Promise<PropertyExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new PropertyImportAIError(
      "AI property import is not configured (missing GEMINI_API_KEY).",
      "MISSING_CONFIG"
    );
  }

  if (!input.text.trim()) {
    throw new PropertyImportAIError("Nothing to extract from — paste the listing text.", "REQUEST_FAILED");
  }

  const body = {
    contents: [buildContents(input)],
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  };

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new PropertyImportAIError(
      timedOut
        ? "AI extraction timed out. Please try again."
        : `AI extraction request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      "REQUEST_FAILED"
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      // ignore — best-effort detail only
    }
    throw new PropertyImportAIError(
      `AI extraction request failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      "REQUEST_FAILED"
    );
  }

  let json: GeminiGenerateContentResponse;
  try {
    json = await response.json();
  } catch {
    throw new PropertyImportAIError("AI extraction returned a non-JSON response.", "REQUEST_FAILED");
  }

  if (json.promptFeedback?.blockReason) {
    throw new PropertyImportAIError(
      `AI extraction was blocked by the provider (${json.promptFeedback.blockReason}).`,
      "REQUEST_FAILED"
    );
  }

  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
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
