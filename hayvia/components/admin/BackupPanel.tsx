"use client";

import { useState, useTransition } from "react";
import { Upload, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { runBackup } from "@/app/admin/(dashboard)/settings/data-actions";
import type { BulkBackupReport } from "@/lib/admin/sheets-backup";

/**
 * Normal-flow, on-demand bulk backup (Supabase -> Sheets). The automatic
 * per-property backup already runs after every admin create/edit (see
 * app/admin/(dashboard)/properties/actions.ts) — this button is for
 * re-syncing everything at once, e.g. after a bulk edit or to retry rows
 * that previously failed (see the Recent Backup Activity log below it).
 */
export default function BackupPanel() {
  const [report, setReport] = useState<BulkBackupReport | null>(null);
  const [pending, startTransition] = useTransition();

  return (
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
        disabled={pending}
        onClick={() => startTransition(async () => setReport(await runBackup()))}
      >
        {pending ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
        Run Full Backup Now
      </Button>

      {report && (
        <div className="mt-3 rounded border border-line-soft bg-line-soft/30 p-3 text-xs text-ink-soft">
          <p>
            {report.succeeded} / {report.total} properties backed up successfully
          </p>
          {report.failed.length > 0 && (
            <div className="mt-2 text-red-500">
              <p className="font-medium">{report.failed.length} failed:</p>
              <ul className="mt-1 list-inside list-disc">
                {report.failed.map((f) => (
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
  );
}
