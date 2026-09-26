"use server";

import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestRawLeadSignal } from "@/lib/radar/lead-ingestion";
import { mapApifyPostToRawLeadSignal, parseApifyDatasetJson } from "@/lib/radar/apify-lead-adapter";
import { screenAndProcessRawLeadSignal } from "@/lib/radar/lead-intelligence";

// -----------------------------------------------------------------------------
// PR #25 — Apify Dataset import + classification, kept as two explicit,
// separately-triggered stages (mirrors PR #24's "ingestion and intelligence
// are separate stages" principle):
//
//   importApifyDataset(): pasted Dataset JSON -> ingestRawLeadSignal() per
//     item (PR #24, unmodified) -> radar_lead_raw only. No AI, no cost.
//
//   classifyPendingLeads(): every radar_lead_raw row that has no
//     radar_lead_screening row yet -> screenAndProcessRawLeadSignal() (the
//     Lead Qualification Gate) per row. A DISCARD verdict creates no
//     candidate at all; QUALIFIED/NEEDS_REVIEW create one and (only for
//     QUALIFIED) run the existing matching engine. Explicit, admin-
//     triggered, bounded — never runs automatically on import, so an admin
//     always sees import counts before choosing to spend on screening.
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
    qualified: number;
    needsReview: number;
    discarded: number;
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

  // "Pending" means not yet SCREENED by the Lead Qualification Gate — a
  // left-anti-join against radar_lead_screening (unique on raw_id), done
  // client-side (two small selects) rather than a raw SQL join, matching
  // this codebase's existing supabase-js query style throughout Radar. A
  // raw row is done once it has ANY screening row, whatever the verdict
  // (QUALIFIED/NEEDS_REVIEW/DISCARD) — it is never re-screened automatically.
  // If the AI call itself fails or OPENAI_API_KEY isn't configured, NO
  // screening row is written (see screenAndProcessRawLeadSignal()), so the
  // raw row stays indistinguishable from never-screened and is retried here
  // on the next run — the same retryable-failure guarantee as before.
  const [{ data: rawRows, error: rawError }, { data: screenedRows, error: screenedError }] = await Promise.all([
    supabase.from("radar_lead_raw").select("id").order("created_at", { ascending: true }).limit(MAX_CLASSIFY_BATCH),
    supabase.from("radar_lead_screening").select("raw_id"),
  ]);
  if (rawError || screenedError) {
    return { error: rawError?.message || screenedError?.message || "Failed to read pending raw lead signals." };
  }

  const screenedRawIds = new Set((screenedRows ?? []).map((r) => r.raw_id as string).filter(Boolean));
  const pending = (rawRows ?? []).filter((r) => !screenedRawIds.has(r.id as string));

  if (pending.length === 0) {
    return {
      summary: { processed: 0, qualified: 0, needsReview: 0, discarded: 0, byCategory: {}, matched: 0, failed: 0, failedDetails: [] },
    };
  }

  const byCategory: Record<string, number> = {};
  let qualified = 0;
  let needsReview = 0;
  let discarded = 0;
  let matched = 0;
  let failed = 0;
  const failedDetails: string[] = [];

  for (const row of pending) {
    const outcome = await screenAndProcessRawLeadSignal(supabase, row.id as string, admin.id);
    if (!outcome.ok) {
      failed++;
      failedDetails.push(`${row.id}: ${outcome.error}`);
      continue;
    }
    if (outcome.outcome === "already_screened") {
      // Shouldn't normally happen (this row wasn't in the pending set), but
      // never miscount if it does — treat as neither a failure nor a fresh verdict.
      continue;
    }
    if (outcome.outcome === "discarded") {
      discarded++;
      byCategory[outcome.category] = (byCategory[outcome.category] ?? 0) + 1;
      continue;
    }
    // qualified | needs_review
    if (outcome.outcome === "qualified") qualified++;
    else needsReview++;
    byCategory[outcome.extraction.category] = (byCategory[outcome.extraction.category] ?? 0) + 1;
    if (outcome.matches.length > 0) matched++;
  }

  return {
    summary: {
      processed: pending.length,
      qualified,
      needsReview,
      discarded,
      byCategory,
      matched,
      failed,
      failedDetails,
    },
  };
}
