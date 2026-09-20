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
