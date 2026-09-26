import { z } from "zod";

// -----------------------------------------------------------------------------
// Phase 8D — Lead Intelligence Foundation (PR #23), extended by PR #25 for
// Apify-sourced classification.
//
// PR #25 merges the original PR #23 `intent` field (BUY/RENT/UNKNOWN) into a
// single `category` classification: BUYER/RENTER/SELLER/UNKNOWN — see this
// PR's design note. Keeping both `intent` and a separate `category` risked
// the two disagreeing (e.g. intent=BUY but category=SELLER); `category` is
// now the ONE classification axis the AI produces. `category` is a Radar
// classification concept, distinct from `purpose` (listing_type_enum,
// RENT/BUY only) which still drives the matching engine exactly as before —
// see lib/radar/lead-intelligence.ts for the category -> purpose mapping
// (BUYER -> BUY, RENTER -> RENT, SELLER/NOISE -> no matching).
//
// Every field here maps to one of three places:
//   - an EXISTING radar_lead_candidates column (property_type, location.*,
//     budget_min, budget_max, bedrooms_min, timeline, and — via the mapping
//     above — purpose),
//   - the new radar_lead_candidates.lead_category column (PR #25,
//     20260923200000_radar_lead_category.sql), denormalized from `category`,
//   - or the free-form `requirements`/`unknowns` bucket, for anything the
//     post expresses that has no dedicated column at all (e.g. "no flood
//     zone", furnished, bathrooms — see radar_lead_analysis.ai_inference,
//     exactly this table's home for "AI inference, not verified fact").
//
// UNKNOWN is a valid, first-class value for `property_type` — property_type_
// enum has no UNKNOWN member, so a literal "UNKNOWN" is never written into
// that column (see lib/radar/lead-intelligence.ts, which only writes a
// field when it isn't UNKNOWN/null). Absence of evidence must never be
// silently converted into a guessed fact.
// -----------------------------------------------------------------------------

// The one classification axis the AI produces. BUYER/RENTER are demand
// signals (a person looking to acquire/rent a property); SELLER is a supply
// signal (someone offering a property — preserved as a Radar signal, never
// auto-converted into a Property Radar candidate in this PR); NOISE is not
// a real estate signal at all.
export const LEAD_CATEGORY_VALUES = ["BUYER", "RENTER", "SELLER", "NOISE"] as const;
export type LeadCategory = (typeof LEAD_CATEGORY_VALUES)[number];

// Lead Qualification Gate — WHO is posting, kept deliberately separate from
// `category` (WHAT TYPE of post this is). A SEEKER is someone looking to
// acquire/rent; OWNER/AGENT are supply-side posters (a SELLER category post
// almost always pairs with OWNER or AGENT); UNKNOWN is the AI's own explicit
// "can't tell" state, never guessed.
export const POSTER_ROLE_VALUES = ["SEEKER", "OWNER", "AGENT", "UNKNOWN"] as const;
export type PosterRole = (typeof POSTER_ROLE_VALUES)[number];

// The Lead Qualification Gate's verdict. QUALIFIED/NEEDS_REVIEW are the only
// two outcomes ever retained as a radar_lead_candidates row (see
// 20260926220000_radar_lead_qualification_gate.sql's CHECK constraint, which
// enforces this at the database level too) — DISCARD never creates a
// candidate at all. False-DISCARD (a genuine seeker wrongly thrown away) is
// the single most dangerous error this gate can make, since discarded
// content is never fully retained for later recovery — see the two
// .refine()s below, which encode this as a hard rule, not just a prompt
// instruction.
export const LEAD_QUALIFICATION_VALUES = ["QUALIFIED", "NEEDS_REVIEW", "DISCARD"] as const;
export type LeadQualification = (typeof LEAD_QUALIFICATION_VALUES)[number];

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
// exactly (radar_foundation.sql). Repurposed by PR #25 as the lead-quality
// signal (how specific/actionable is this post), read the same way for
// BUYER/RENTER/SELLER alike — kept apart from `category` (what TYPE of post
// this is) so a well-specified SELLER post and a vague one are still
// distinguishable, not just lumped together as "SELLER". For NOISE,
// STRONG_INTENT/etc. don't really apply — NOISE_SPAM is the expected value.
export const LEAD_INTENT_CATEGORY_VALUES = ["STRONG_INTENT", "PROBABLE_INTENT", "WEAK_INTENT", "NOISE_SPAM"] as const;
export type LeadIntentCategory = (typeof LEAD_INTENT_CATEGORY_VALUES)[number];

const requirementItemSchema = z.object({
  field: z.string().min(1).max(80),
  value: z.string().min(1).max(300),
  evidence: z.string().min(1).max(300),
});

export const leadRequirementSchema = z
  .object({
    category: z.enum(LEAD_CATEGORY_VALUES),
    poster_role: z.enum(POSTER_ROLE_VALUES),
    qualification: z.enum(LEAD_QUALIFICATION_VALUES),
    property_type: z.enum(LEAD_PROPERTY_TYPE_VALUES),
    location: z.object({
      province: z.string().min(1).max(120).nullable(),
      city: z.string().min(1).max(120).nullable(),
      district: z.string().min(1).max(120).nullable(),
    }),
    // Demand-side budget ONLY — what a BUYER/RENTER can spend. Never a
    // SELLER's asking price (see the refine() below, which hard-rejects any
    // extraction that puts a SELLER post's price here rather than in
    // `requirements`). This is the exact field lib/radar/lead-intelligence.ts
    // feeds into MatchCriteria.budgetMin/budgetMax, so conflating the two
    // meanings would silently corrupt matching.
    budget_min: z.number().nonnegative().nullable(),
    budget_max: z.number().nonnegative().nullable(),
    bedrooms_min: z.number().int().nonnegative().max(20).nullable(),
    timeline: z.string().min(1).max(200).nullable(),
    intent_category: z.enum(LEAD_INTENT_CATEGORY_VALUES),
    intent_score: z.number().min(0).max(100),
    confidence: z.number().min(0).max(100),
    // Short, human-readable summary of WHY this category/classification was
    // chosen — distinct from the granular per-requirement `evidence` below;
    // this is the one-line explanation an admin reads first.
    reason: z.string().min(1).max(300),
    // Bounded, not because 20 is a magic product number, but as a basic
    // sanity cap — a well-formed extraction from one short post should
    // never legitimately produce more than a handful of these. Also where
    // bathrooms and any other requirement without a dedicated column
    // belongs (no bathrooms column exists on radar_lead_candidates — kept
    // out of the schema deliberately, see this PR's design note).
    requirements: z.array(requirementItemSchema).max(20),
    unknowns: z.array(z.string().min(1).max(120)).max(20),
  })
  .refine((v) => v.budget_min == null || v.budget_max == null || v.budget_min <= v.budget_max, {
    message: "budget_min must be less than or equal to budget_max",
    path: ["budget_min"],
  })
  .refine((v) => v.category !== "SELLER" || (v.budget_min == null && v.budget_max == null), {
    message:
      "SELLER posts must not populate budget_min/budget_max (that field means buyer/renter budget, never an asking price) — put any price mentioned in requirements[] instead",
    path: ["budget_min"],
  })
  .refine((v) => v.poster_role !== "SEEKER" || v.qualification !== "DISCARD", {
    message:
      "poster_role=SEEKER must never be paired with qualification=DISCARD — a genuine seeker is never discarded. Use NEEDS_REVIEW if uncertain, QUALIFIED if confident.",
    path: ["qualification"],
  })
  .refine((v) => v.qualification !== "QUALIFIED" || v.category === "BUYER" || v.category === "RENTER", {
    message: "qualification=QUALIFIED requires category BUYER or RENTER — a genuine seeker is never SELLER/NOISE.",
    path: ["qualification"],
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
// (The SELLER-budget refine() above has no JSON Schema equivalent — strict
// mode can't express cross-field conditionals — so it's enforced purely by
// the zod pass after the response comes back.)
// -----------------------------------------------------------------------------
export const LEAD_REQUIREMENT_JSON_SCHEMA = {
  name: "lead_requirement_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      category: { type: "string", enum: [...LEAD_CATEGORY_VALUES] },
      poster_role: { type: "string", enum: [...POSTER_ROLE_VALUES] },
      qualification: { type: "string", enum: [...LEAD_QUALIFICATION_VALUES] },
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
      reason: { type: "string" },
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
      "category",
      "poster_role",
      "qualification",
      "property_type",
      "location",
      "budget_min",
      "budget_max",
      "bedrooms_min",
      "timeline",
      "intent_category",
      "intent_score",
      "confidence",
      "reason",
      "requirements",
      "unknowns",
    ],
  },
} as const;
