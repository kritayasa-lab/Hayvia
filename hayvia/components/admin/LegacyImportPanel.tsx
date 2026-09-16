"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";
import { runLegacyImport } from "@/app/admin/(dashboard)/settings/data-actions";
import type { LegacyImportReport } from "@/lib/admin/legacy-sheets-import";

/**
 * LEGACY / MANUAL — one-off migration tool, not part of normal operations.
 * Supabase is the source of truth; new/edited properties are created
 * directly in Admin, not by editing the Sheet. This exists only to pull in
 * rows that still only live in the old Sheet and were never created here.
 */
export default function LegacyImportPanel() {
  const [report, setReport] = useState<LegacyImportReport | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded border border-dashed border-clay-400/60 bg-clay-100/30 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-clay-500" />
        <div>
          <p className="text-sm font-medium text-ink">Legacy: Import from Google Sheets</p>
          <p className="mt-1 text-xs text-ink-faint">
            Manual, one-off migration only — not part of normal operations. Use this only to pull
            in property rows that still exist solely in the old Sheet and were never created in
            Admin. New and edited properties should be managed directly here, not in the Sheet.
            Idempotent (matched by ID) and never touches owner/agent/source/commission/private
            notes or Price Reduced.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="md"
        className="mt-3"
        disabled={pending}
        onClick={() => startTransition(async () => setReport(await runLegacyImport()))}
      >
        {pending ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
        Run Legacy Import
      </Button>

      {report && (
        <div className="mt-3 rounded border border-line-soft bg-surface p-3 text-xs text-ink-soft">
          {report.success ? (
            <>
              <p>
                {report.totalInSheet} properties in Sheets · {report.created} created ·{" "}
                {report.updated} updated
              </p>
              <p className="mt-1">
                Supabase properties: {report.totalInSupabaseBefore} → {report.totalInSupabaseAfter}
              </p>
              {report.failed.length > 0 && (
                <div className="mt-2 text-red-500">
                  <p className="font-medium">{report.failed.length} require manual review:</p>
                  <ul className="mt-1 list-inside list-disc">
                    {report.failed.map((f) => (
                      <li key={f.id}>
                        {f.title || f.id}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-red-500">{report.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
