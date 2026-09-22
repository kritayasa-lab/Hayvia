import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// -----------------------------------------------------------------------------
// Phase 8C/8D-2/8D-3 — Property Radar AI analysis.
//
// Phase 8D-3 adds a real provider (Claude) behind runPropertyAiAnalysis(),
// via the PropertyAiProvider interface below — Radar's business logic
// (runAiAnalysisAction, the UI) depends only on that interface and on the
// PropertyAiAnalysisResult contract, never on the Anthropic SDK directly.
// Swapping providers means writing a new PropertyAiProvider and changing
// getConfiguredProvider() — no other file changes.
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
 * Decision logic (Phase 8D-1/8D-2/8D-3, evidence-based — never inferred from
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

  /** Populated only when configured is true. */
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
  if (
    typeof v.value !== "string" ||
    !(allowed as readonly string[]).includes(v.value) ||
    !isConfidence(v.confidence) ||
    !isStringArray(v.evidence)
  ) {
    return false;
  }
  // Never accept a non-UNKNOWN classification with no supporting evidence —
  // mirrors the same constraint the Zod schema enforces at the SDK boundary
  // (see classificationShape() below). Kept here too since this is the
  // last line of defense before a DB write: UNKNOWN may have empty
  // evidence, but OWNER/AGENT/AGENCY/OWNER_DIRECT/OPEN_CO_BROKER/
  // AGENT_ONLY must not.
  if (v.value !== "UNKNOWN" && (v.evidence as string[]).length === 0) {
    return false;
  }
  return true;
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
 * store partial/unsupported/fabricated fields. This is the LAST line of
 * defense before a DB write — see runAiAnalysisAction() in
 * app/admin/(dashboard)/radar/properties/actions.ts, the only caller. Kept
 * even though the Claude provider already validates via Zod at the SDK
 * boundary (getConfiguredProvider() below): never trust a single validation
 * layer for a database write, and a future provider might not validate as
 * strictly.
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

// -----------------------------------------------------------------------------
// Provider abstraction (Phase 8D-3) — Radar's business logic depends only on
// this interface, never on a specific AI vendor's SDK.
// -----------------------------------------------------------------------------

export interface PropertyAiProvider {
  analyze(input: PropertyAiAnalysisInput): Promise<PropertyAiAnalysisResult>;
}

/**
 * Thrown when a provider call completed but its output failed structured
 * validation (Zod, for the Claude provider) — distinct from a thrown
 * infrastructure error (network/auth/rate limit), which propagates as-is.
 * runAiAnalysisAction() maps this to a specific "invalid result, not saved"
 * UI state, and a thrown infra error to a separate "analysis failed, try
 * again" state — see that file for the full mapping.
 */
export class InvalidAiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAiOutputError";
  }
}

// The prompt/schema version this module currently implements — bumped
// whenever the classification rules or extracted fields change, independent
// of the underlying model. Stored in radar_property_analysis.model_version
// so old analysis rows stay attributable to the exact rules that produced
// them, even after this file changes.
const PROMPT_VERSION = "8d3-v1";

// Mirrors PropertyFacts exactly — same field set as isValidFacts() above, so
// nothing the model returns can pass Zod but then be rejected by the
// second, DB-boundary validation layer.
const PropertyFactsShape = z.object({
  property_type: z.string().nullable(),
  listing_type: z.enum(["RENT", "BUY", "UNKNOWN"]),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  province: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  neighborhood: z.string().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  land_size_sqm: z.number().nullable(),
  usable_area_sqm: z.number().nullable(),
});

function classificationShape<T extends [string, ...string[]]>(values: T) {
  return z
    .object({
      value: z.enum(values),
      confidence: z.number().min(0).max(100),
      evidence: z.array(z.string()),
    })
    .refine((data) => data.value === "UNKNOWN" || data.evidence.length > 0, {
      message: "A non-UNKNOWN classification must include at least one evidence item.",
      path: ["evidence"],
    });
}

const PropertyAiOutputSchema = z.object({
  poster: classificationShape(["OWNER", "AGENT", "AGENCY", "UNKNOWN"] as const),
  acquisition: classificationShape(["OWNER_DIRECT", "OPEN_CO_BROKER", "AGENT_ONLY", "UNKNOWN"] as const),
  facts: PropertyFactsShape,
  aiInference: z.record(z.string(), z.unknown()),
  unknowns: z.array(z.string()),
  evidence: z.record(z.string(), z.array(z.string())),
  confidence: z.number().min(0).max(100),
});

const SYSTEM_PROMPT = `You are Subphiphat Real Estate's Property Radar analyst. You review a single \
discovered property post and produce a structured, evidence-based classification. You never fabricate \
data. If something is not clearly supported by the source text, you report it as unknown rather than guess.

## Your two classification tasks

### 1. Poster type — who is presenting the property
One of: OWNER, AGENT, AGENCY, UNKNOWN.
Only classify as OWNER, AGENT, or AGENCY when the source text explicitly identifies who is posting. \
Never infer this from how personal or professional the writing sounds. If the poster's identity isn't \
explicitly stated, the answer is UNKNOWN.

### 2. Acquisition type — what Subphiphat could actually do with this listing
One of: OWNER_DIRECT, OPEN_CO_BROKER, AGENT_ONLY, UNKNOWN. Apply this decision logic exactly, in order:
1. Poster is OWNER + the text has an explicit owner-direct signal (e.g. "เจ้าของขายเอง", "เจ้าของขาย", \
"ไม่ผ่านนายหน้า", "for sale by owner", "no agents") -> OWNER_DIRECT
2. Poster is OWNER + the text has an explicit co-broker signal (e.g. "รับนายหน้า", "เปิด Co-broker", \
"รับเอเจนต์", "มีค่าคอมให้", "แบ่งค่าคอมได้", "co-broke welcome", "commission offered") -> OPEN_CO_BROKER
3. Poster is AGENT or AGENCY + the text has an explicit co-broker signal -> OPEN_CO_BROKER
4. Poster is AGENT or AGENCY + the text has an explicit closed/no-co-broker signal (e.g. "ไม่รับนายหน้า \
ภายนอก", "contact our team only", "no external agents") -> AGENT_ONLY
5. Evidence is insufficient or conflicting -> UNKNOWN

CRITICAL: never infer OWNER_DIRECT or AGENT_ONLY merely from the ABSENCE of co-broker language. The \
absence of a signal is not itself a signal. If you can't point to an explicit phrase supporting a specific \
value, the answer is UNKNOWN. AGENT_ONLY specifically requires BOTH an identified agent/agency AND an \
explicit closed signal — an agent post that simply doesn't mention co-broking is UNKNOWN, not AGENT_ONLY.

For both classifications, quote the exact supporting phrase(s) from the source text in \`evidence\` (in \
their original language — do not translate). If you classify as UNKNOWN, \`evidence\` should normally be \
empty.

## Property facts

Extract only what the source text or structured data actually states: property_type, listing_type (RENT, \
BUY, or UNKNOWN), price, currency, province, city, district, neighborhood, bedrooms, bathrooms, \
land_size_sqm, usable_area_sqm. Leave any field you cannot support as null and add its name to \`unknowns\`. \
Never fabricate or estimate a value that is not actually present in the source — this applies especially to \
price, location, size, and room counts. Never invent ownership, commission, title/deed, market value, \
seller identity, or contact information; if the source doesn't state it, it belongs in \`unknowns\`, not in \
\`facts\` or \`aiInference\`.

Use \`aiInference\` only for genuine interpretive notes beyond the literal facts (e.g. "post mentions recent \
renovation") — never for anything that should have gone in \`facts\` or a classification's \`evidence\`.

\`confidence\` is your overall confidence in this analysis as a whole (0-100) — confidence in the \
classification, never certainty that the underlying facts are true.`;

// Fields that must never leave this system, even though they're harmless
// to store in radar_property_raw itself — currently just `submittedBy`
// (the admin's own profile UUID, written by createManualCandidate() in
// app/admin/(dashboard)/radar/properties/actions.ts). It has no analytical
// value to the model and no reason to be sent to an external provider. This
// only affects what's serialized into the prompt below — the stored raw
// row, and the admin-facing Raw Evidence viewer on the candidate detail
// page, are untouched.
const PROMPT_EXCLUDED_RAW_PAYLOAD_KEYS = ["submittedBy"];

function sanitizeRawPayloadForPrompt(rawPayload: unknown): unknown {
  if (typeof rawPayload !== "object" || rawPayload === null || Array.isArray(rawPayload)) {
    return rawPayload;
  }
  const sanitized = { ...(rawPayload as Record<string, unknown>) };
  for (const key of PROMPT_EXCLUDED_RAW_PAYLOAD_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

function buildUserPrompt(input: PropertyAiAnalysisInput): string {
  const knownFacts = JSON.stringify(input.facts, null, 2);
  const rawPayload = JSON.stringify(sanitizeRawPayloadForPrompt(input.rawPayload) ?? null, null, 2);
  return `Already-known structured facts for this candidate (from manual intake — treat as a starting \
point, not ground truth; re-derive from the source text below where possible):
${knownFacts}

Raw source evidence (the actual post content is usually in a "description" or "evidenceNotes" field):
${rawPayload}

Classify poster type and acquisition type, extract property facts, and report confidence/evidence/unknowns \
per your instructions.`;
}

class ClaudePropertyAiProvider implements PropertyAiProvider {
  private readonly client: Anthropic;

  constructor(client: Anthropic) {
    this.client = client;
  }

  async analyze(input: PropertyAiAnalysisInput): Promise<PropertyAiAnalysisResult> {
    const response = await this.client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: zodOutputFormat(PropertyAiOutputSchema),
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    if (response.stop_reason === "refusal") {
      throw new InvalidAiOutputError("AI analysis provider declined to analyze this candidate.");
    }

    if (!response.parsed_output) {
      throw new InvalidAiOutputError("AI analysis provider returned output that failed schema validation.");
    }

    const parsed = response.parsed_output;

    return {
      configured: true,
      poster: parsed.poster,
      acquisition: parsed.acquisition,
      facts: parsed.facts,
      aiInference: parsed.aiInference,
      unknowns: parsed.unknowns,
      evidence: parsed.evidence,
      confidence: parsed.confidence,
      modelName: response.model,
      modelVersion: PROMPT_VERSION,
    };
  }
}

let cachedProvider: PropertyAiProvider | null | undefined;

/**
 * Returns the currently-configured provider, or null if none is available
 * (no ANTHROPIC_API_KEY). Reads the env var lazily and caches the result for
 * the life of this server process — matches how every other env-gated
 * integration in this codebase is checked (e.g. lib/admin/sheets-backup.ts's
 * GOOGLE_APPS_SCRIPT_BACKUP_URL), no new config mechanism introduced.
 */
function getConfiguredProvider(): PropertyAiProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;

  if (!process.env.ANTHROPIC_API_KEY) {
    cachedProvider = null;
    return cachedProvider;
  }

  cachedProvider = new ClaudePropertyAiProvider(new Anthropic());
  return cachedProvider;
}

/**
 * Single entry point Radar's business logic calls — never fabricates an
 * analysis. Returns `configured: false` when no provider is available.
 * Throws (InvalidAiOutputError, or an Anthropic SDK error class for an
 * infrastructure failure) when a provider is configured but the call
 * didn't produce a usable result — callers must not insert a
 * radar_property_analysis row unless `result.configured` is true AND
 * `isValidConfiguredResult(result)` passes.
 */
export async function runPropertyAiAnalysis(
  input: PropertyAiAnalysisInput
): Promise<PropertyAiAnalysisResult> {
  const provider = getConfiguredProvider();
  if (!provider) {
    return {
      configured: false,
      message: "AI analysis provider is not configured yet.",
    };
  }

  return provider.analyze(input);
}
