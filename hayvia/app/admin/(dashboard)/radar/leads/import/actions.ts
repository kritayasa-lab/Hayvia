"use server";

import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestRawLeadSignal } from "@/lib/radar/lead-ingestion";
import { mapApifyPostToRawLeadSignal, parseApifyDatasetJson } from "@/lib/radar/apify-lead-adapter";
import { runLeadIntelligenceForRaw } from "@/lib/radar/lead-intelligence";

// -----------------------------------------------------------------------------
// PR #25 — Apify Dataset import + classification, kept as two explicit,
// separately-triggered stages (mirrors PR #24's "ingestion and intelligence
// are separate stages" principle):
//
//   importApifyDataset(): pasted Dataset JSON -> ingestRawLeadSignal() per
//     item (PR #24, unmodified) -> radar_lead_raw only. No AI, no cost.
//
//   classifyPendingLeads(): every radar_lead_raw row that has no
//     radar_lead_candidates yet -> runLeadIntelligenceForRaw() (PR #25) per
//     row -> classification + (for BUYER/RENTER) matching. Explicit,
//     admin-triggered, bounded — never runs automatically on import, so an
//     admin always sees import counts before choosing to spend on
//     classification.
// -----------------------------------------------------------------------------

const MAX_DATASET_ITEMS = 200;
// Bounds one admin click's worth of AI spend — matches the real test run's
// scale (58 items) with headroom, without letting a huge paste trigger an
// unbounded number of OpenAI calls in one request.
const MAX_CLASSIFY_BATCH = 100;

export interface ImportDatasetState {
  error?: string;
  summary?: {
    total: number;
    created: number;
    deduped: number;
    rejected: number;
    rejectedDetails: string[];
  };
}

export async function importApifyDataset(
  _prevState: ImportDatasetState | null,
  formData: FormData
): Promise<ImportDatasetState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const raw = String(formData.get("dataset_json") || "").trim();
  if (!raw) return { error: "Please paste a Dataset JSON array." };

  const parsedDataset = parseApifyDatasetJson(raw);
  if (!parsedDataset.ok) return { error: parsedDataset.error };

  if (parsedDataset.items.length === 0) return { error: "Dataset array is empty." };
  if (parsedDataset.items.length > MAX_DATASET_ITEMS) {
    return { error: `Dataset has ${parsedDataset.items.length} items — please import at most ${MAX_DATASET_ITEMS} at a time.` };
  }

  const supabase = createAdminClient();

  let created = 0;
  let deduped = 0;
  let rejected = 0;
  const rejectedDetails: string[] = [];

  for (let i = 0; i < parsedDataset.items.length; i++) {
    const mapped = mapApifyPostToRawLeadSignal(parsedDataset.items[i]);
    if (!mapped.ok) {
      rejected++;
      rejectedDetails.push(`Item ${i + 1}: ${mapped.error}`);
      continue;
    }

    const result = await ingestRawLeadSignal(supabase, mapped.input);
    if (!result.ok) {
      rejected++;
      rejectedDetails.push(`Item ${i + 1} (${mapped.input.sourceUrl ?? "no url"}): ${result.error}`);
      continue;
    }
    if (result.outcome === "created") created++;
    else deduped++;
  }

  return {
    summary: {
      total: parsedDataset.items.length,
      created,
      deduped,
      rejected,
      rejectedDetails,
    },
  };
}

export interface ClassifyPendingState {
  error?: string;
  summary?: {
    processed: number;
    byCategory: Record<string, number>;
    matched: number;
    failed: number;
    failedDetails: string[];
  };
}

export async function classifyPendingLeads(
  _prevState: ClassifyPendingState | null,
  _formData: FormData
): Promise<ClassifyPendingState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const supabase = createAdminClient();

  // Every raw signal that has no candidate yet — left-anti-join done
  // client-side (two small selects) rather than a raw SQL join, matching
  // this codebase's existing supabase-js query style throughout Radar.
  const [{ data: rawRows, error: rawError }, { data: promotedRows, error: promotedError }] = await Promise.all([
    supabase.from("radar_lead_raw").select("id").order("created_at", { ascending: true }).limit(MAX_CLASSIFY_BATCH),
    supabase.from("radar_lead_candidates").select("raw_id"),
  ]);
  if (rawError || promotedError) {
    return { error: rawError?.message || promotedError?.message || "Failed to read pending raw lead signals." };
  }

  const promotedIds = new Set((promotedRows ?? []).map((r) => r.raw_id as string).filter(Boolean));
  const pending = (rawRows ?? []).filter((r) => !promotedIds.has(r.id as string));

  if (pending.length === 0) {
    return { summary: { processed: 0, byCategory: {}, matched: 0, failed: 0, failedDetails: [] } };
  }

  const byCategory: Record<string, number> = {};
  let matched = 0;
  let failed = 0;
  const failedDetails: string[] = [];

  for (const row of pending) {
    const outcome = await runLeadIntelligenceForRaw(supabase, row.id as string, admin.id);
    if (!outcome.ok) {
      failed++;
      failedDetails.push(`${row.id}: ${outcome.error}`);
      continue;
    }
    const category = outcome.extraction.category;
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    if (outcome.matches.length > 0) matched++;
  }

  return {
    summary: {
      processed: pending.length,
      byCategory,
      matched,
      failed,
      failedDetails,
    },
  };
}
