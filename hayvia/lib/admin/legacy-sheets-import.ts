import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPropertiesFromSheet } from "@/lib/properties-source";
import { syncPropertyToSupabase } from "@/lib/supabase/properties-sync";

// -----------------------------------------------------------------------------
// LEGACY / MANUAL MIGRATION TOOL — NOT PART OF THE NORMAL APPLICATION FLOW.
// -----------------------------------------------------------------------------
// Supabase is the source of truth now; Google Sheets is backup/export only
// (see lib/admin/sheets-backup.ts for the direction that DOES run
// automatically, Supabase -> Sheets, after every admin property save).
//
// This file is the opposite direction, Sheets -> Supabase, and is
// deliberately NOT wired into any automatic flow — no admin save, no page
// load, no scheduled job calls this. It exists only for the one-off/rare
// manual case of pulling in property rows that still only exist in the old
// Sheet and were never created directly in Admin. Trigger it explicitly from
// Admin > Settings > "Legacy Tools" (clearly labeled there as legacy/manual).
// -----------------------------------------------------------------------------

export interface LegacyImportReport {
  success: boolean;
  error?: string;
  totalInSheet: number;
  totalInSupabaseBefore: number;
  totalInSupabaseAfter: number;
  created: number;
  updated: number;
  failed: { id: string; title: string; error: string }[];
}

/**
 * Bulk-imports every property currently in Google Sheets into Supabase,
 * idempotently, by calling the same syncPropertyToSupabase() the demo-data-
 * fallback guest-sync path also uses — see that file for exactly which
 * fields sync and which admin-only fields (owner/agent/source/commission/
 * private_notes/price_reduced) are deliberately never touched.
 *
 * Deliberately does NOT fall back to demo data on a Sheets fetch failure —
 * that fallback exists for the public website (so a visitor never sees a
 * broken page), but silently importing placeholder demo listings into
 * Supabase as if they were real inventory would be actively wrong. A Sheets
 * fetch failure here is reported as a failed import, not masked.
 *
 * Admin-only — call this from a route/action that has already verified
 * getAdminUser().
 */
export async function legacyImportPropertiesFromSheets(): Promise<LegacyImportReport> {
  const supabase = createAdminClient();

  const { count: beforeCount } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });

  let sheetProperties;
  try {
    sheetProperties = await fetchPropertiesFromSheet();
  } catch (error) {
    return {
      success: false,
      error: `Could not reach Google Sheets: ${error instanceof Error ? error.message : "unknown error"}`,
      totalInSheet: 0,
      totalInSupabaseBefore: beforeCount ?? 0,
      totalInSupabaseAfter: beforeCount ?? 0,
      created: 0,
      updated: 0,
      failed: [],
    };
  }

  let created = 0;
  let updated = 0;
  const failed: { id: string; title: string; error: string }[] = [];

  for (const property of sheetProperties) {
    try {
      const { data: existing } = await supabase
        .from("properties")
        .select("id")
        .eq("external_ref", property.id)
        .maybeSingle();

      await syncPropertyToSupabase(property);

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
    } catch (error) {
      failed.push({
        id: property.id,
        title: property.title,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const { count: afterCount } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });

  return {
    success: true,
    totalInSheet: sheetProperties.length,
    totalInSupabaseBefore: beforeCount ?? 0,
    totalInSupabaseAfter: afterCount ?? 0,
    created,
    updated,
    failed,
  };
}
