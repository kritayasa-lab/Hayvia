"use client";

import { useState, useTransition } from "react";
import { Download, Upload, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { runImport, runBackup } from "@/app/admin/(dashboard)/settings/data-actions";
import type { ImportReport } from "@/lib/admin/sheets-import";
import type { BulkBackupReport } from "@/lib/admin/sheets-backup";

export default function DataSyncPanel() {
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [backupReport, setBackupReport] = useState<BulkBackupReport | null>(null);
  const [importPending, startImport] = useTransition();
  const [backupPending, startBackup] = useTransition();

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <p className="text-sm font-medium text-ink">Import from Google Sheets</p>
        <p className="mt-1 text-xs text-ink-faint">
          Idempotent — safe to run more than once. Updates existing properties (matched by ID),
          creates new ones, never duplicates. Owner/agent/source/commission/private notes and
          Price Reduced are never touched by an import.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="mt-3"
          disabled={importPending}
          onClick={() => startImport(async () => setImportReport(await runImport()))}
        >
          {importPending ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Run Import
        </Button>

        {importReport && (
          <div className="mt-3 rounded border border-line-soft bg-line-soft/30 p-3 text-xs text-ink-soft">
            {importReport.success ? (
              <>
                <p>
                  {importReport.totalInSheet} properties in Sheets · {importReport.created} created ·{" "}
                  {importReport.updated} updated
                </p>
                <p className="mt-1">
                  Supabase properties: {importReport.totalInSupabaseBefore} → {importReport.totalInSupabaseAfter}
                </p>
                {importReport.failed.length > 0 && (
                  <div className="mt-2 text-red-500">
                    <p className="font-medium">{importReport.failed.length} require manual review:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {importReport.failed.map((f) => (
                        <li key={f.id}>
                          {f.title || f.id}: {f.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-red-500">{importReport.error}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Backup to Google Sheets</p>
        <p className="mt-1 text-xs text-ink-faint">
          Writes every Supabase property back to the same public-safe columns Sheets has always
          had. Existing rows (matched by ID) are updated in place; new properties are appended.
          Never includes owner/agent/source/commission/private notes.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="mt-3"
          disabled={backupPending}
          onClick={() => startBackup(async () => setBackupReport(await runBackup()))}
        >
          {backupPending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          Run Full Backup Now
        </Button>

        {backupReport && (
          <div className="mt-3 rounded border border-line-soft bg-line-soft/30 p-3 text-xs text-ink-soft">
            <p>
              {backupReport.succeeded} / {backupReport.total} properties backed up successfully
            </p>
            {backupReport.failed.length > 0 && (
              <div className="mt-2 text-red-500">
                <p className="font-medium">{backupReport.failed.length} failed:</p>
                <ul className="mt-1 list-inside list-disc">
                  {backupReport.failed.map((f) => (
                    <li key={f.propertyId}>
                      {f.title}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
