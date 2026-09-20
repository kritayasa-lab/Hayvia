import "server-only";

// -----------------------------------------------------------------------------
// Phase 8C — Property Radar AI analysis.
//
// No provider is connected in this phase. This module exists so the
// candidate/review system (Server Actions, the detail page's "Run AI
// Analysis" button, the versioned radar_property_analysis schema) can be
// built and exercised now, against a real interface, without waiting on a
// provider decision. Swapping in a real call later means implementing the
// body of runPropertyAiAnalysis() — every caller, and the DB schema it
// writes into, stays the same.
//
// When a real provider is added, it must keep returning facts / ai_inference
// / unknowns / evidence as separate structured fields — never one blended
// free-text response — so the UI can keep drawing a hard line between what
// the source evidence actually says and what the model inferred. Nothing
// here may ever report `configured: true` with fabricated content; until a
// real provider exists, this always returns `configured: false`.
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

export interface PropertyAiAnalysisResult {
  /** false in this phase, always — no provider is wired up. */
  configured: boolean;
  /** Human-readable reason, shown in the UI when `configured` is false. */
  message?: string;
  /** Populated only when configured is true (not reachable in Phase 8C). */
  facts?: Record<string, unknown>;
  aiInference?: Record<string, unknown>;
  unknowns?: string[];
  evidence?: Record<string, unknown>;
  confidence?: number;
  modelName?: string;
  modelVersion?: string;
}

/**
 * Stub. Always reports "not configured" — never fabricates an analysis.
 * Callers must not insert a radar_property_analysis row when
 * `result.configured` is false.
 */
export async function runPropertyAiAnalysis(
  _input: PropertyAiAnalysisInput
): Promise<PropertyAiAnalysisResult> {
  return {
    configured: false,
    message: "AI analysis provider is not configured yet.",
  };
}
