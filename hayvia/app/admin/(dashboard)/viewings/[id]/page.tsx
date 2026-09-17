import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import StatusSelect from "@/components/admin/StatusSelect";
import { statusEntities } from "@/lib/admin/status-config";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function loadViewing(id: string) {
  const supabase = createAdminClient();

  const { data: viewing } = await supabase
    .from("viewings")
    .select("*, properties(title)")
    .eq("id", id)
    .single();

  if (!viewing) return { viewing: null, notes: [], history: [] };

  // viewings.lead_id is a direct, nullable FK to leads — nothing currently
  // populates it (the public /api/viewings route doesn't create a linked
  // lead), so this is schema-correct and forward-compatible but will render
  // empty for every existing row today. That's expected, not a bug here.
  if (!viewing.lead_id) {
    return { viewing, notes: [], history: [] };
  }

  const [{ data: notes }, { data: history }] = await Promise.all([
    supabase
      .from("lead_notes")
      .select("id, note, created_at, profiles(full_name)")
      .eq("lead_id", viewing.lead_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_status_history")
      .select("id, from_status, to_status, changed_at, profiles(full_name)")
      .eq("lead_id", viewing.lead_id)
      .order("changed_at", { ascending: false }),
  ]);

  return { viewing, notes: notes ?? [], history: history ?? [] };
}

export default async function ViewingDetailPage({ params }: { params: { id: string } }) {
  const { viewing, notes, history } = await loadViewing(params.id);
  if (!viewing) notFound();

  const propertyTitle = (viewing.properties as unknown as { title?: string } | null)?.title ?? null;

  return (
    <div>
      <Link href="/admin/viewings" className="text-xs font-medium text-ink-faint hover:text-ink">
        &larr; Back to Viewing Requests
      </Link>

      <h1 className="mt-2 font-display text-2xl text-ink">{viewing.customer_name || "Unnamed Customer"}</h1>
      <p className="mt-1 text-sm text-ink-faint">
        {viewing.viewing_type === "VIDEO_CALL" ? "Video Call" : "In-person"} · Requested{" "}
        {formatDate(viewing.created_at)}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <AdminCard title="Customer & Context">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Email</dt>
                <dd className="text-ink">{viewing.customer_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Phone</dt>
                <dd className="text-ink">{viewing.customer_phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Property</dt>
                <dd className="text-ink">{propertyTitle || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Preferred Date</dt>
                <dd className="text-ink">
                  {viewing.preferred_date ? formatDate(viewing.preferred_date) : "—"}
                  {viewing.preferred_time ? ` at ${viewing.preferred_time}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Comment</dt>
                <dd className="whitespace-pre-wrap text-ink">{viewing.notes || "—"}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Status">
            <StatusSelect
              entity="viewings"
              id={viewing.id}
              value={viewing.status}
              options={statusEntities.viewings.options}
            />
          </AdminCard>
        </div>

        <AdminCard
          title="Notes & Status History"
          description={
            viewing.lead_id
              ? undefined
              : "No linked CRM lead for this viewing request — notes and status history live on that record."
          }
        >
          {viewing.lead_id ? (
            <div className="space-y-6">
              <Link
                href={`/admin/leads/${viewing.lead_id}`}
                className="text-sm font-medium text-moss-700 hover:underline"
              >
                Open full lead record &rarr;
              </Link>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Notes</p>
                {notes.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-faint">No notes yet.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {notes.map((n) => (
                      <div key={n.id} className="rounded border border-line-soft p-3">
                        <p className="whitespace-pre-wrap text-sm text-ink">{n.note}</p>
                        <p className="mt-1 text-xs text-ink-faint">
                          {formatDate(n.created_at)}
                          {(n.profiles as unknown as { full_name?: string } | null)?.full_name &&
                            ` · ${(n.profiles as unknown as { full_name?: string }).full_name}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-line-soft pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Status History</p>
                {history.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-faint">No status changes recorded yet.</p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {history.map((row) => (
                      <li key={row.id} className="text-sm">
                        <p className="text-ink">
                          {row.from_status ? `${row.from_status} → ${row.to_status}` : `Set to ${row.to_status}`}
                        </p>
                        <p className="text-xs text-ink-faint">{formatDate(row.changed_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">Nothing to show yet.</p>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
