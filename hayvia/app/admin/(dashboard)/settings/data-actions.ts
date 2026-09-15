"use server";

import { getAdminUser } from "@/lib/auth/admin";
import { importPropertiesFromSheets, type ImportReport } from "@/lib/admin/sheets-import";
import { backupAllPropertiesToSheets, type BulkBackupReport } from "@/lib/admin/sheets-backup";

export async function runImport(): Promise<ImportReport> {
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
  return importPropertiesFromSheets();
}

export async function runBackup(): Promise<BulkBackupReport> {
  const admin = await getAdminUser();
  if (!admin) {
    return { total: 0, succeeded: 0, failed: [] };
  }
  return backupAllPropertiesToSheets();
}
