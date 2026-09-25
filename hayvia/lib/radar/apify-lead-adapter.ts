import "server-only";
import { z } from "zod";
import type { RawLeadSignalInput } from "@/lib/radar/lead-ingestion";

// -----------------------------------------------------------------------------
// PR #25 — Apify Dataset item -> RawLeadSignalInput (lib/radar/lead-ingestion.ts,
// PR #24, unmodified). Pure, deterministic normalization only — never calls
// AI, never decides whether a post is a lead. This is the adapter PR #24's
// own ingestion boundary was designed for: it never depended on Apify at
// all, so nothing there needed to change.
//
// No live Apify integration here: no apify-client, no APIFY_API_TOKEN, no
// webhook, no polling. The input to mapApifyDatasetToRawLeadSignals() is a
// plain array of Dataset items — e.g. pasted/uploaded JSON exported from a
// real Apify run (Actor: lofomachines/facebook-groups-posts-search-scraper).
// A live puller can be built in a future PR by producing this same array
// shape and calling the same functions.
// -----------------------------------------------------------------------------

// The field shape actually observed from a real test run of
// lofomachines/facebook-groups-posts-search-scraper. post_url, text, and
// group_name are required — the pipeline can't dedupe, classify, or
// attribute a source without them. Everything else is optional/nullable
// (Apify's own output can omit engagement counts, etc.) and passed through
// into raw_payload verbatim via .passthrough() — including any field not
// listed here, since raw_payload must preserve the original evidence, not
// a filtered subset of it.
const apifyFacebookPostSchema = z
  .object({
    post_url: z.string().min(1),
    text: z.string().min(1),
    image_url: z.string().nullable().optional(),
    author_name: z.string().nullable().optional(),
    author_id: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
    reaction_count: z.number().nullable().optional(),
    comment_count: z.number().nullable().optional(),
    share_count: z.number().nullable().optional(),
    group_name: z.string().min(1),
    group_url: z.string().nullable().optional(),
    group_id: z.string().nullable().optional(),
    processed_at: z.string().nullable().optional(),
  })
  .passthrough();

export type ApifyFacebookPost = z.infer<typeof apifyFacebookPostSchema>;

export type MapApifyItemResult = { ok: true; input: RawLeadSignalInput } | { ok: false; error: string };

// Strips query string/fragment (tracking params Facebook/Apify sometimes
// vary between scrapes of the same post) so the SAME post scraped twice
// still produces the same sourceIdentifier and dedupes correctly via
// ingestRawLeadSignal()'s existing unique-index path. Falls back to the
// original string if it isn't a parseable URL — never throws, ingestion
// still works, just without this normalization.
function normalizePostUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Validates and normalizes ONE raw Apify Dataset item into the shape
 * ingestRawLeadSignal() (PR #24) expects. Rejects a malformed item (missing
 * post_url/text/group_name, or not an object at all) with a clear error —
 * never guesses a placeholder value for a required field.
 */
export function mapApifyPostToRawLeadSignal(item: unknown): MapApifyItemResult {
  const parsed = apifyFacebookPostSchema.safeParse(item);
  if (!parsed.success) {
    return { ok: false, error: `Malformed Apify item: ${parsed.error.message}` };
  }
  const post = parsed.data;

  return {
    ok: true,
    input: {
      source: { type: "FACEBOOK_GROUP", name: post.group_name },
      sourceUrl: post.post_url,
      sourceIdentifier: normalizePostUrl(post.post_url),
      // The full original item, unfiltered — preserves every field Apify
      // returned (including ones not in the schema above, via
      // .passthrough()), never interpreted here. lib/radar/lead-intelligence.ts
      // reads raw_payload.text back out of this to classify.
      rawPayload: { ...post },
      discoveredAt: post.date ?? undefined,
      lastSeenAt: post.processed_at ?? undefined,
    },
  };
}

export interface ApifyDatasetImportSummary {
  total: number;
  malformed: Array<{ index: number; error: string }>;
  results: Array<{ index: number; outcome: "created" | "deduped" | "rejected"; rawId?: string; error?: string; postUrl?: string }>;
}

/**
 * Validates that `input` is an array — the one shape check this file does
 * before handing items off one at a time. Does not touch the database;
 * see app/admin/(dashboard)/radar/leads/import/actions.ts for the action
 * that pairs this with ingestRawLeadSignal() per item.
 */
export function parseApifyDatasetJson(raw: string): { ok: true; items: unknown[] } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Dataset is not valid JSON." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Dataset JSON must be an array of items (an Apify Dataset export)." };
  }
  return { ok: true, items: parsed };
}
