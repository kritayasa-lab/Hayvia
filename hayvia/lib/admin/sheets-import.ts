import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPropertiesFromSheet } from "@/lib/properties-source";
import { syncPropertyToSupabase } from "@/lib/supabase/properties-sync";

export interface ImportReport {
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
 * idempotently, by calling the same syncPropertyToSupabase() the lazy guest-
 * triggered sync already uses — see that file for exactly which fields sync
 * and which admin-only fields are deliberately never touched.
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
export async function importPropertiesFromSheets(): Promise<ImportReport> {
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
