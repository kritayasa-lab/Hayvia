import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import MatchingWeightsForm from "@/components/admin/MatchingWeightsForm";
import BackupPanel from "@/components/admin/BackupPanel";
import LegacyImportPanel from "@/components/admin/LegacyImportPanel";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { retryBackup } from "@/app/admin/(dashboard)/settings/data-actions";

export const dynamic = "force-dynamic";

async function fetchActiveWeights() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("matching_weights").select("*").eq("is_active", true).single();
  return data;
}

async function fetchRecentBackupLogs() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("backup_logs")
    .select("id, entity_id, status, destination, error_message, attempted_at")
    .order("attempted_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

export default async function AdminSettingsPage() {
  const [weights, backupLogs] = await Promise.all([fetchActiveWeights(), fetchRecentBackupLogs()]);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-faint">Configuration and data sync for Subphiphat Real Estate.</p>

      <div className="mt-6 max-w-3xl space-y-6">
        <AdminCard
          title="Google Sheets Backup"
          description="Supabase is the source of truth for every property. Google Sheets is backup/export only — every admin save automatically syncs to Sheets after Supabase succeeds; this is for re-syncing everything on demand."
        >
          <BackupPanel />
        </AdminCard>

        <AdminCard title="Recent Backup Activity">
          {backupLogs.length === 0 ? (
            <p className="text-sm text-ink-faint">No backup attempts logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Destination</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Error</th>
                    <th className="py-2 pr-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {backupLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 pr-3 text-ink-soft">{formatDate(log.attempted_at)}</td>
                      <td className="py-2 pr-3 text-ink-soft">{log.destination}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={log.status === "SUCCESS" ? "moss" : "clay"}>{log.status}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-ink-faint">{log.error_message || "—"}</td>
                      <td className="py-2 pr-3">
                        {log.status === "FAILED" && (
                          <form action={retryBackup.bind(null, log.entity_id)}>
                            <button type="submit" className="text-xs font-medium text-moss-700 hover:underline">
                              Retry
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>

        <AdminCard
          title="Legacy Tools"
          description="Manual, one-off migration utilities — not part of normal day-to-day operations."
        >
          <LegacyImportPanel />
        </AdminCard>

        <AdminCard
          title="Matching Engine Weights"
          description="Changes apply to every new Get Matched run immediately — no deploy needed."
        >
          {weights ? (
            <MatchingWeightsForm weights={weights} />
          ) : (
            <p className="text-sm text-ink-faint">No active weights row found.</p>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
