"use server";

import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestRawLeadSignal } from "@/lib/radar/lead-ingestion";

// -----------------------------------------------------------------------------
// Phase 8D — Lead Radar ingestion foundation (PR #24). Admin-only proof that
// a mock external signal lands in radar_lead_raw via the same
// ingestRawLeadSignal() boundary a future Apify adapter would call —
// requirement #9. Deliberately thin: this action's only job is to turn a
// form submission into the plain input object ingestRawLeadSignal() expects,
// call it, and read back what was actually stored. No AI, no candidate
// creation — see lib/radar/lead-ingestion.ts's own header comment for why.
// -----------------------------------------------------------------------------

export interface IngestionTestState {
  error?: string;
  result?: {
    outcome: "created" | "deduped";
    rawId: string;
    row: {
      sourceType: string;
      sourceName: string;
      sourceUrl: string | null;
      sourceIdentifier: string | null;
      rawPayload: unknown;
      contentFingerprint: string | null;
      discoveredAt: string;
      lastSeenAt: string;
    };
  };
}

export async function runIngestionTest(
  _prevState: IngestionTestState | null,
  formData: FormData
): Promise<IngestionTestState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const sourceType = String(formData.get("source_type") || "");
  const sourceName = String(formData.get("source_name") || "").trim();
  const sourceUrl = String(formData.get("source_url") || "").trim();
  const sourceIdentifier = String(formData.get("source_identifier") || "").trim();
  const rawPayloadText = String(formData.get("raw_payload") || "").trim();

  if (!sourceName) return { error: "Please enter a source name." };
  if (!rawPayloadText) return { error: "Please paste a mock raw payload (JSON)." };

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawPayloadText);
  } catch {
    return { error: "Raw payload must be valid JSON — this mimics what a malformed Apify Dataset item would trigger." };
  }

  const supabase = createAdminClient();

  const result = await ingestRawLeadSignal(supabase, {
    source: { type: sourceType, name: sourceName },
    sourceUrl: sourceUrl || null,
    sourceIdentifier: sourceIdentifier || null,
    rawPayload,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  const { data: row, error: readError } = await supabase
    .from("radar_lead_raw")
    .select("source_url, source_identifier, raw_payload, content_fingerprint, discovered_at, last_seen_at, radar_sources(source_type, name)")
    .eq("id", result.rawId)
    .single();

  if (readError || !row) {
    return { error: `Ingestion reported success (${result.outcome}), but reading the stored row back failed.` };
  }

  const source = row.radar_sources as unknown as { source_type: string; name: string } | null;

  return {
    result: {
      outcome: result.outcome,
      rawId: result.rawId,
      row: {
        sourceType: source?.source_type ?? sourceType,
        sourceName: source?.name ?? sourceName,
        sourceUrl: row.source_url as string | null,
        sourceIdentifier: row.source_identifier as string | null,
        rawPayload: row.raw_payload,
        contentFingerprint: row.content_fingerprint as string | null,
        discoveredAt: row.discovered_at as string,
        lastSeenAt: row.last_seen_at as string,
      },
    },
  };
}
