"use server";

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import {
  legacyImportPropertiesFromSheets,
  type LegacyImportReport,
} from "@/lib/admin/legacy-sheets-import";
import {
  backupAllPropertiesToSheets,
  backupPropertyToSheets,
  type BulkBackupReport,
} from "@/lib/admin/sheets-backup";

/**
 * LEGACY / MANUAL — pulls property rows from Google Sheets into Supabase.
 * Not part of the normal save flow; only reachable from the "Legacy Tools"
 * section of Admin > Settings. See lib/admin/legacy-sheets-import.ts.
 */
export async function runLegacyImport(): Promise<LegacyImportReport> {
  const admin = await getAdminUser();
  if (!admin) {
    return {
      success: false,
      error: "Not authorized.",
      totalInSheet: 0,
      totalInSupabaseBefore: 0,
      totalInSupabaseAfter: 0,
      created: 0,
      updated: 0,
      failed: [],
    };
  }
  return legacyImportPropertiesFromSheets();
}

/**
 * Normal-flow backup — pushes every Supabase property to Google Sheets
 * on demand ("Run Full Backup Now"). The direction this architecture treats
 * as standard (Supabase -> Sheets); see lib/admin/sheets-backup.ts.
 */
export async function runBackup(): Promise<BulkBackupReport> {
  const admin = await getAdminUser();
  if (!admin) {
    return { total: 0, succeeded: 0, failed: [] };
  }
  return backupAllPropertiesToSheets();
}

/**
 * Retries a single failed backup attempt (requirement: a Sheets backup
 * failure must be retryable). Plain form action bound to one property id
 * from the Recent Backup Activity log — re-runs the same idempotent upsert,
 * which logs its own new backup_logs row either way.
 */
export async function retryBackup(propertyId: string) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  await backupPropertyToSheets(propertyId);
  redirect("/admin/settings");
}
