import "server-only";

// -----------------------------------------------------------------------------
// Phase 8C/8D-2 — Property Radar AI analysis.
//
// No provider is connected yet. This module exists so the candidate/review
// system (Server Actions, the detail page's "Run AI Analysis" button, the
// versioned radar_property_analysis schema) can be built and exercised now,
// against a real interface, without waiting on a provider decision. Swapping
// in a real call later means implementing the body of runPropertyAiAnalysis()
// — every caller, and the DB schema it writes into, stays the same.
//
// Phase 8D-2 widens the contract with evidence-based poster/acquisition
// classification (see PosterType/AcquisitionType below), per the Phase 8D-1
// design report. The stub's behavior is unchanged: runPropertyAiAnalysis()
// always returns `configured: false` until a real provider exists. Nothing
// here may ever report `configured: true` with fabricated content.
//
// FACTS / AI_INFERENCE / UNKNOWN / EVIDENCE stay structurally separate (see
// PropertyAiAnalysisResult below) so the UI can keep drawing a hard line
// between what the source evidence actually says and what the model
// inferred, and so an inference can never silently become a stored fact.
// -----------------------------------------------------------------------------

export interface PropertyAiAnalysisInput {
  candidateId: string;
  facts: {
    propertyType: string | null;
    province: string | null;
    city: string | null;
    district: string | null;
    price: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sizeSqm: number | null;
    description: string | null;
  };
  rawPayload: unknown;
}

// -----------------------------------------------------------------------------
// Classification types — evidence-based only. Never inferred from tone or
// how "personal"/"professional" a post sounds; only from explicit signals in
// the source text. UNKNOWN is always the correct answer when evidence is
// insufficient or conflicting — never a fallback default that gets treated
// as a positive claim (see AcquisitionType below in particular).
// -----------------------------------------------------------------------------

/** Who is presenting the property. Never inferred — only from explicit self-identification in the source. */
export type PosterType = "OWNER" | "AGENT" | "AGENCY" | "UNKNOWN";

/**
 * What Subphiphat could actually do with this listing.
 *
 * Decision logic (Phase 8D-1/8D-2, evidence-based — never inferred from
 * absence of language):
 *   1. OWNER + explicit owner-direct signal            -> OWNER_DIRECT
 *   2. OWNER + explicit co-broker signal                -> OPEN_CO_BROKER
 *   3. AGENT/AGENCY + explicit co-broker signal          -> OPEN_CO_BROKER
 *   4. AGENT/AGENCY + explicit closed/no-co-broker signal -> AGENT_ONLY
 *   5. Insufficient or conflicting evidence              -> UNKNOWN
 *
 * AGENT_ONLY specifically requires BOTH an identified agent/agency AND an
 * explicit closed/no-co-broker signal — the mere absence of co-broker
 * language is not evidence of AGENT_ONLY, it's evidence of UNKNOWN.
 * Likewise OWNER_DIRECT requires an explicit owner-direct signal, not just
 * the absence of co-broker language from an identified owner.
 */
export type AcquisitionType = "OWNER_DIRECT" | "OPEN_CO_BROKER" | "AGENT_ONLY" | "UNKNOWN";

/** Matches the existing listing_type_enum values (RENT/BUY) — never "SALE". */
export type ListingTypeGuess = "RENT" | "BUY" | "UNKNOWN";

export interface ClassificationResult<T extends string> {
  value: T;
  /** Confidence in the classification itself (0-100) — not certainty that the underlying facts are true. */
  confidence: number;
  /** Verbatim snippet(s) from the source text supporting this classification. An empty array is valid and expected when value is UNKNOWN — never fabricated to justify a classification. */
  evidence: string[];
}

/**
 * Only fields that are realistically extractable from a property post's text
 * and structured source data. Every field is independently nullable/omittable
 * — a missing field belongs in `unknowns`, never guessed here.
 */
export interface PropertyFacts {
  property_type: string | null;
  listing_type: ListingTypeGuess;
  price: number | null;
  currency: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  /** Finer-grained than district (e.g. a specific soi/village name). Free text, analysis-only — not a radar_property_candidates column. */
  neighborhood: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  land_size_sqm: number | null;
  usable_area_sqm: number | null;
}

export interface PropertyAiAnalysisResult {
  /** false until a provider is actually wired up — always true today. */
  configured: boolean;
  /** Human-readable reason, shown in the UI when `configured` is false. */
  message?: string;

  /** Populated only when configured is true (not reachable in Phase 8D-2 — no provider exists yet). */
  poster?: ClassificationResult<PosterType>;
  acquisition?: ClassificationResult<AcquisitionType>;
  facts?: Partial<PropertyFacts>;
  aiInference?: Record<string, unknown>;
  /** Field names / short descriptions of what could not be determined from the source. */
  unknowns?: string[];
  /** Per-field verbatim evidence snippets, keyed by field name. */
  evidence?: Record<string, string[]>;
  /** Overall analysis confidence, 0-100. */
  confidence?: number;
  modelName?: string;
  modelVersion?: string;
}

const POSTER_TYPES: readonly PosterType[] = ["OWNER", "AGENT", "AGENCY", "UNKNOWN"];
const ACQUISITION_TYPES: readonly AcquisitionType[] = [
  "OWNER_DIRECT",
  "OPEN_CO_BROKER",
  "AGENT_ONLY",
  "UNKNOWN",
];
const LISTING_TYPE_GUESSES: readonly ListingTypeGuess[] = ["RENT", "BUY", "UNKNOWN"];

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isClassificationResult<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is ClassificationResult<T> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.value === "string" &&
    (allowed as readonly string[]).includes(v.value) &&
    isConfidence(v.confidence) &&
    isStringArray(v.evidence)
  );
}

function isValidFacts(value: unknown): value is Partial<PropertyFacts> {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  const stringOrNull = (k: string) => f[k] === undefined || f[k] === null || typeof f[k] === "string";
  const numberOrNull = (k: string) => f[k] === undefined || f[k] === null || typeof f[k] === "number";
  if (f.listing_type !== undefined && !(LISTING_TYPE_GUESSES as readonly string[]).includes(f.listing_type as string)) {
    return false;
  }
  return (
    stringOrNull("property_type") &&
    stringOrNull("currency") &&
    stringOrNull("province") &&
    stringOrNull("city") &&
    stringOrNull("district") &&
    stringOrNull("neighborhood") &&
    numberOrNull("price") &&
    numberOrNull("bedrooms") &&
    numberOrNull("bathrooms") &&
    numberOrNull("land_size_sqm") &&
    numberOrNull("usable_area_sqm")
  );
}

function isValidEvidence(value: unknown): value is Record<string, string[]> {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).every((v) => isStringArray(v));
}

/**
 * Validates a `configured: true` result before it's ever persisted. Rejects
 * (rather than best-effort-repairs) anything malformed — a caller must never
 * store partial/unsupported/fabricated fields. See runAiAnalysisAction() in
 * app/admin/(dashboard)/radar/properties/actions.ts, the only caller.
 */
export function isValidConfiguredResult(
  result: PropertyAiAnalysisResult
): result is PropertyAiAnalysisResult & {
  poster: ClassificationResult<PosterType>;
  acquisition: ClassificationResult<AcquisitionType>;
  facts: Partial<PropertyFacts>;
  unknowns: string[];
  evidence: Record<string, string[]>;
  confidence: number;
} {
  if (!result.configured) return false;
  return (
    isClassificationResult(result.poster, POSTER_TYPES) &&
    isClassificationResult(result.acquisition, ACQUISITION_TYPES) &&
    isValidFacts(result.facts) &&
    isStringArray(result.unknowns) &&
    isValidEvidence(result.evidence) &&
    isConfidence(result.confidence)
  );
}

/**
 * Stub. Always reports "not configured" — never fabricates an analysis.
 * Callers must not insert a radar_property_analysis row when
 * `result.configured` is false, and must run `isValidConfiguredResult()`
 * before persisting anything when it's true.
 */
export async function runPropertyAiAnalysis(
  _input: PropertyAiAnalysisInput
): Promise<PropertyAiAnalysisResult> {
  return {
    configured: false,
    message: "AI analysis provider is not configured yet.",
  };
}
