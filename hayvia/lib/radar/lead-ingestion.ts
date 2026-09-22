import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateSource } from "@/lib/radar/sources";
import { RADAR_SOURCE_TYPES } from "@/lib/radar/source-types";

// -----------------------------------------------------------------------------
// Phase 8D — Lead Radar ingestion foundation (PR #24).
//
//   Future Apify Actor -> raw lead signal -> radar_lead_raw -> existing Lead
//   Intelligence Foundation (PR #23)
//
// This file is the ONE internal boundary a future ingestion source calls —
// a webhook route, a Dataset-polling script, or (today) the admin mock-
// payload test action. It deliberately:
//   - takes a plain SupabaseClient + plain input object, no dependency on
//     cookies/session/getAdminUser/"use server" — so it's equally callable
//     from a future unauthenticated-but-signature-verified webhook handler
//     as from an admin Server Action.
//   - stops at radar_lead_raw. It does NOT create a radar_lead_candidates
//     row and does NOT call the AI extraction from PR #23
//     (lib/radar/lead-extraction.ts) — ingestion and intelligence are kept
//     as separate stages, per this PR's explicit scope. Promoting a raw
//     signal into a candidate (and optionally triggering extraction) is a
//     separate, not-yet-decomposed concern belonging to a future phase.
//   - never asks AI to interpret or transform raw_payload — the payload
//     goes into the database exactly as given.
//
// No new tables or columns: radar_lead_raw already has everything this
// needs, including a content_fingerprint column that was defined in Phase
// 8B but never used until now, and a unique index
// (ux_radar_lead_raw_source_identifier) whose own migration comment already
// anticipated this exact function — see idempotency handling below.
// -----------------------------------------------------------------------------

export const rawLeadSignalSchema = z.object({
  source: z.object({
    type: z.enum(RADAR_SOURCE_TYPES),
    name: z.string().min(1).max(200),
  }),
  sourceUrl: z.string().min(1).max(2000).nullable().optional(),
  sourceIdentifier: z.string().min(1).max(500).nullable().optional(),
  // Apify Dataset items are arbitrary JSON objects — this only rejects the
  // shapes that could never be meaningful evidence (not an object, empty).
  // No AI/interpretation happens here or anywhere else in this file.
  rawPayload: z
    .record(z.string(), z.unknown())
    .refine((v) => Object.keys(v).length > 0, { message: "rawPayload must not be empty" }),
  discoveredAt: z.string().min(1).nullable().optional(),
  lastSeenAt: z.string().min(1).nullable().optional(),
});

export type RawLeadSignalInput = z.infer<typeof rawLeadSignalSchema>;

export type RawLeadSignalIngestResult =
  | { ok: true; outcome: "created"; rawId: string; sourceId: string }
  | { ok: true; outcome: "deduped"; rawId: string; sourceId: string }
  | { ok: false; error: string };

// Deterministic regardless of key order — two ingestions of "the same"
// content shouldn't be treated as different just because a source
// serialized its JSON differently between runs.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function computeContentFingerprint(rawPayload: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(rawPayload)).digest("hex");
}

/**
 * Lands one raw external signal into radar_lead_raw. Validates `input`
 * against rawLeadSignalSchema before touching the database — a malformed
 * payload is rejected with `{ ok: false, error }` and nothing is written,
 * not even the source row.
 *
 * Idempotency (requirement: repeated ingestion of the same source item must
 * not create duplicate evidence rows):
 *   - When `sourceIdentifier` is given, relies on the existing
 *     (source_id, source_identifier) unique index. A conflicting insert is
 *     treated as "already ingested" — this function bumps the existing
 *     row's last_seen_at and returns `outcome: "deduped"` with the SAME
 *     rawId, rather than erroring or creating a second row. The original
 *     raw_payload is never overwritten on a dedup hit.
 *   - When no `sourceIdentifier` is available (not every source provides a
 *     stable external id), falls back to a content-fingerprint lookup
 *     (sha256 of the raw payload) scoped to the same source. This is a
 *     soft check-then-act, not a DB constraint — acceptable here since an
 *     identifier-less source is inherently the lower-confidence path, not
 *     the primary one this function optimizes for.
 */
export async function ingestRawLeadSignal(
  supabase: SupabaseClient,
  input: unknown
): Promise<RawLeadSignalIngestResult> {
  const parsed = rawLeadSignalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Malformed raw lead signal: ${parsed.error.message}` };
  }
  const signal = parsed.data;

  let sourceId: string;
  try {
    sourceId = await findOrCreateSource(supabase, { type: signal.source.type, name: signal.source.name });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to resolve the Radar source." };
  }

  const fingerprint = computeContentFingerprint(signal.rawPayload);
  const timestampColumns: Record<string, string> = {};
  if (signal.discoveredAt) timestampColumns.discovered_at = signal.discoveredAt;
  if (signal.lastSeenAt) timestampColumns.last_seen_at = signal.lastSeenAt;

  if (signal.sourceIdentifier) {
    const { data: inserted, error: insertError } = await supabase
      .from("radar_lead_raw")
      .insert({
        source_id: sourceId,
        source_url: signal.sourceUrl ?? null,
        source_identifier: signal.sourceIdentifier,
        raw_payload: signal.rawPayload,
        content_fingerprint: fingerprint,
        ...timestampColumns,
      })
      .select("id")
      .single();

    if (inserted) {
      return { ok: true, outcome: "created", rawId: inserted.id as string, sourceId };
    }

    // 23505 = unique_violation. Anything else is a genuine failure.
    if (insertError?.code === "23505") {
      return bumpExistingRawSignal(supabase, sourceId, { source_identifier: signal.sourceIdentifier }, signal.lastSeenAt);
    }

    return { ok: false, error: insertError?.message || "Failed to save the raw lead signal." };
  }

  const { data: existingByFingerprint } = await supabase
    .from("radar_lead_raw")
    .select("id")
    .eq("source_id", sourceId)
    .eq("content_fingerprint", fingerprint)
    .maybeSingle();

  if (existingByFingerprint) {
    return bumpExistingRawSignal(supabase, sourceId, { id: existingByFingerprint.id as string }, signal.lastSeenAt);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("radar_lead_raw")
    .insert({
      source_id: sourceId,
      source_url: signal.sourceUrl ?? null,
      source_identifier: null,
      raw_payload: signal.rawPayload,
      content_fingerprint: fingerprint,
      ...timestampColumns,
    })
    .select("id")
    .single();

  if (!inserted) {
    return { ok: false, error: insertError?.message || "Failed to save the raw lead signal." };
  }
  return { ok: true, outcome: "created", rawId: inserted.id as string, sourceId };
}

async function bumpExistingRawSignal(
  supabase: SupabaseClient,
  sourceId: string,
  lookup: { source_identifier: string } | { id: string },
  lastSeenAt: string | null | undefined
): Promise<RawLeadSignalIngestResult> {
  let query = supabase.from("radar_lead_raw").select("id").eq("source_id", sourceId);
  query = "id" in lookup ? query.eq("id", lookup.id) : query.eq("source_identifier", lookup.source_identifier);
  const { data: existing } = await query.maybeSingle();

  if (!existing) {
    // Should be unreachable (we only get here after a unique-violation or a
    // successful fingerprint lookup), but never claim a dedup hit without
    // one actually on hand.
    return { ok: false, error: "Failed to locate the existing raw lead signal after a duplicate was detected." };
  }

  const rawId = existing.id as string;
  const { error: updateError } = await supabase
    .from("radar_lead_raw")
    .update({ last_seen_at: lastSeenAt || new Date().toISOString() })
    .eq("id", rawId);

  if (updateError) {
    // eslint-disable-next-line no-console
    console.error(`[Subphiphat] Deduped raw lead signal ${rawId}, but updating last_seen_at failed:`, updateError);
  }

  return { ok: true, outcome: "deduped", rawId, sourceId };
}
