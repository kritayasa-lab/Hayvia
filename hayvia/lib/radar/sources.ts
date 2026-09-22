import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// Phase 8C — shared MANUAL radar_sources row, reused by manual Property
// Radar (and, later, Lead Radar) intake rather than creating a new source
// row per submission. Race-safe insert-then-fallback-to-lookup on the
// unique-violation path, same pattern findOrCreateCustomer() already uses
// in lib/customers/identity.ts for concurrent creation of a shared row.
// -----------------------------------------------------------------------------

const MANUAL_SOURCE_NAME = "Manual Entry";

export async function findOrCreateManualSource(supabase: SupabaseClient): Promise<string> {
  const { data: existing } = await supabase
    .from("radar_sources")
    .select("id")
    .eq("source_type", "MANUAL")
    .eq("name", MANUAL_SOURCE_NAME)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("radar_sources")
    .insert({ source_type: "MANUAL", name: MANUAL_SOURCE_NAME })
    .select("id")
    .single();

  if (created) return created.id as string;

  // Lost a race with a concurrent first-ever manual submission — re-look up
  // rather than fail.
  const { data: retried } = await supabase
    .from("radar_sources")
    .select("id")
    .eq("source_type", "MANUAL")
    .eq("name", MANUAL_SOURCE_NAME)
    .maybeSingle();

  if (retried) return retried.id as string;

  throw new Error(`Failed to find or create the Manual Entry radar source: ${error?.message ?? "unknown error"}`);
}

// -----------------------------------------------------------------------------
// Phase 8D — Lead Radar ingestion foundation. Same race-safe
// insert-then-fallback-to-lookup pattern as findOrCreateManualSource() above,
// generalized to any radar_source_type_enum value + name rather than the
// hardcoded MANUAL row — a future Apify adapter's ingestion calls will
// resolve a real source (e.g. a specific Facebook group) through this, not
// through findOrCreateManualSource(). findOrCreateManualSource() itself is
// left untouched rather than rewritten in terms of this function — zero risk
// of changing Property Radar's or Lead Radar's existing manual-intake
// behavior for a refactor that isn't otherwise necessary.
// -----------------------------------------------------------------------------

export interface RadarSourceInput {
  type: string;
  name: string;
  sourceUrl?: string | null;
}

export async function findOrCreateSource(supabase: SupabaseClient, input: RadarSourceInput): Promise<string> {
  const { data: existing } = await supabase
    .from("radar_sources")
    .select("id")
    .eq("source_type", input.type)
    .eq("name", input.name)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("radar_sources")
    .insert({ source_type: input.type, name: input.name, source_url: input.sourceUrl ?? null })
    .select("id")
    .single();

  if (created) return created.id as string;

  // Lost a race with a concurrent first-ever ingestion of this same source —
  // re-look up rather than fail.
  const { data: retried } = await supabase
    .from("radar_sources")
    .select("id")
    .eq("source_type", input.type)
    .eq("name", input.name)
    .maybeSingle();

  if (retried) return retried.id as string;

  throw new Error(`Failed to find or create Radar source "${input.name}": ${error?.message ?? "unknown error"}`);
}
