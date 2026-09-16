import { CheckCircle2, Clock } from "lucide-react";

/**
 * Shown at the top of the property edit page right after a create/save
 * redirect. Supabase is always authoritative by the time this renders (the
 * redirect only happens after a successful Supabase write) — this banner
 * only ever communicates the SEPARATE Google Sheets backup outcome, and
 * never in a way that could read as "the property itself failed to save."
 */
export default function SaveStatusBanner({
  justCreated,
  backupStatus,
}: {
  justCreated: boolean;
  backupStatus: "success" | "pending" | null;
}) {
  if (!backupStatus) return null;

  return (
    <div className="mb-6 flex items-center gap-2 rounded border border-moss-100 bg-moss-50 px-4 py-3 text-sm text-moss-700">
      <CheckCircle2 size={16} className="shrink-0" />
      <span>
        {justCreated ? "Property created and saved to Supabase." : "Saved to Supabase."}{" "}
        {backupStatus === "success" ? (
          "Backed up to Google Sheets."
        ) : (
          <span className="inline-flex items-center gap-1 text-clay-500">
            <Clock size={13} /> Google Sheets backup pending — see Settings to retry.
          </span>
        )}
      </span>
    </div>
  );
}
