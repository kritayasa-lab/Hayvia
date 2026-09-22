import { z } from "zod";

// -----------------------------------------------------------------------------
// Phase 8D — Lead Intelligence Foundation.
//
// The structured shape an AI extraction pass converts a raw natural-language
// buyer/renter post into. Deliberately kept snake_case throughout (matching
// radar_lead_candidates' own column names — intent -> purpose, budget_min,
// budget_max, bedrooms_min -> bedrooms, timeline) so there is no translation
// layer between "what the model returned" and "what gets written to the
// row" beyond the explicit, auditable mapping in the Server Action that
// does the writing.
//
// Every field here maps to one of two places:
//   - an EXISTING radar_lead_candidates column (intent, property_type,
//     location.*, budget_min, budget_max, bedrooms_min, timeline), or
//   - the free-form `requirements`/`unknowns` bucket, for anything the post
//     expresses that has no dedicated column at all (e.g. "no flood zone",
//     furnished, near BTS) — kept as evidenced free text for a human
//     reviewer rather than inventing a new database column per requirement
//     type. See radar_lead_analysis.ai_inference, which is exactly this
//     table's home for "AI inference, not verified fact".
//
// UNKNOWN is a valid, first-class value for `intent`/`property_type` —
// listing_type_enum and property_type_enum have no UNKNOWN member, so a
// literal "UNKNOWN" is never written into those columns (see
// app/admin/(dashboard)/radar/leads/test/actions.ts, which only writes a
// field when it isn't UNKNOWN/null). Absence of evidence must never be
// silently converted into a guessed fact.
// -----------------------------------------------------------------------------

export const LEAD_INTENT_VALUES = ["BUY", "RENT", "UNKNOWN"] as const;
export type LeadIntent = (typeof LEAD_INTENT_VALUES)[number];

// Mirrors property_type_enum (20260912100001_extensions_and_enums.sql)
// exactly, plus UNKNOWN — the AI's own explicit "not stated" state, never
// written to the property_type_enum column itself.
export const LEAD_PROPERTY_TYPE_VALUES = [
  "CONDO",
  "APARTMENT",
  "HOUSE",
  "TOWNHOUSE",
  "VILLA",
  "LAND",
  "COMMERCIAL",
  "OTHER",
  "UNKNOWN",
] as const;
export type LeadPropertyType = (typeof LEAD_PROPERTY_TYPE_VALUES)[number];

// Mirrors radar_lead_analysis.intent_category's existing CHECK constraint
// exactly (radar_foundation.sql) — distinguishes demand-signal strength
// (is this a real, specific ask, or noise/spam?) from property-poster
// verification (explicitly out of scope for Lead Radar's AI — see the
// Lead Intelligence Foundation PR description).
export const LEAD_INTENT_CATEGORY_VALUES = ["STRONG_INTENT", "PROBABLE_INTENT", "WEAK_INTENT", "NOISE_SPAM"] as const;
export type LeadIntentCategory = (typeof LEAD_INTENT_CATEGORY_VALUES)[number];

const requirementItemSchema = z.object({
  field: z.string().min(1).max(80),
  value: z.string().min(1).max(300),
  evidence: z.string().min(1).max(300),
});

export const leadRequirementSchema = z
  .object({
    intent: z.enum(LEAD_INTENT_VALUES),
    property_type: z.enum(LEAD_PROPERTY_TYPE_VALUES),
    location: z.object({
      province: z.string().min(1).max(120).nullable(),
      city: z.string().min(1).max(120).nullable(),
      district: z.string().min(1).max(120).nullable(),
    }),
    budget_min: z.number().nonnegative().nullable(),
    budget_max: z.number().nonnegative().nullable(),
    bedrooms_min: z.number().int().nonnegative().max(20).nullable(),
    timeline: z.string().min(1).max(200).nullable(),
    intent_category: z.enum(LEAD_INTENT_CATEGORY_VALUES),
    intent_score: z.number().min(0).max(100),
    confidence: z.number().min(0).max(100),
    // Bounded, not because 20 is a magic product number, but as a basic
    // sanity cap — a well-formed extraction from one short post should
    // never legitimately produce more than a handful of these.
    requirements: z.array(requirementItemSchema).max(20),
    unknowns: z.array(z.string().min(1).max(120)).max(20),
  })
  .refine((v) => v.budget_min == null || v.budget_max == null || v.budget_min <= v.budget_max, {
    message: "budget_min must be less than or equal to budget_max",
    path: ["budget_min"],
  });

export type LeadRequirementExtraction = z.infer<typeof leadRequirementSchema>;

// -----------------------------------------------------------------------------
// JSON Schema for the OpenAI Structured Outputs request (response_format:
// { type: "json_schema", ... }). Hand-written rather than derived from the
// zod schema above — OpenAI's strict mode has its own constraints (every
// property listed in `required`, `additionalProperties: false` at every
// object level, optionality expressed as a ["type", "null"] union rather
// than an absent key) that don't automatically fall out of a zod schema
// across zod versions. The two are kept in sync by hand; leadRequirementSchema
// is the real gate — this only shapes what the model is allowed to return.
// -----------------------------------------------------------------------------
export const LEAD_REQUIREMENT_JSON_SCHEMA = {
  name: "lead_requirement_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: { type: "string", enum: [...LEAD_INTENT_VALUES] },
      property_type: { type: "string", enum: [...LEAD_PROPERTY_TYPE_VALUES] },
      location: {
        type: "object",
        additionalProperties: false,
        properties: {
          province: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          district: { type: ["string", "null"] },
        },
        required: ["province", "city", "district"],
      },
      budget_min: { type: ["number", "null"] },
      budget_max: { type: ["number", "null"] },
      bedrooms_min: { type: ["integer", "null"] },
      timeline: { type: ["string", "null"] },
      intent_category: { type: "string", enum: [...LEAD_INTENT_CATEGORY_VALUES] },
      intent_score: { type: "number" },
      confidence: { type: "number" },
      requirements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            field: { type: "string" },
            value: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["field", "value", "evidence"],
        },
      },
      unknowns: { type: "array", items: { type: "string" } },
    },
    required: [
      "intent",
      "property_type",
      "location",
      "budget_min",
      "budget_max",
      "bedrooms_min",
      "timeline",
      "intent_category",
      "intent_score",
      "confidence",
      "requirements",
      "unknowns",
    ],
  },
} as const;
