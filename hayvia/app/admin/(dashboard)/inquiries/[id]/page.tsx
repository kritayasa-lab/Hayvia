import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import StatusSelect from "@/components/admin/StatusSelect";
import { statusEntities } from "@/lib/admin/status-config";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function loadInquiry(id: string) {
  const supabase = createAdminClient();

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*, properties(title)")
    .eq("id", id)
    .single();

  if (!inquiry) return { inquiry: null, notes: [], history: [], linkedLeadId: null };

  // Best-effort link — app/api/inquiries/route.ts creates a matching `leads`
  // row (source_type = INQUIRY, inquiry_id = this inquiry) at submission
  // time, but that insert is best-effort, so it may not exist for every
  // inquiry (older rows, or if that secondary insert ever failed). When it
  // does exist, surface its notes/history read-only rather than duplicating
  // that data model here.
  const { data: linkedLead } = await supabase
    .from("leads")
    .select("id")
    .eq("inquiry_id", id)
    .maybeSingle();

  if (!linkedLead) {
    return { inquiry, notes: [], history: [], linkedLeadId: null };
  }

  const [{ data: notes }, { data: history }] = await Promise.all([
    supabase
      .from("lead_notes")
      .select("id, note, created_at, profiles(full_name)")
      .eq("lead_id", linkedLead.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_status_history")
      .select("id, from_status, to_status, changed_at, profiles(full_name)")
      .eq("lead_id", linkedLead.id)
      .order("changed_at", { ascending: false }),
  ]);

  return { inquiry, notes: notes ?? [], history: history ?? [], linkedLeadId: linkedLead.id as string };
}

export default async function InquiryDetailPage({ params }: { params: { id: string } }) {
  const { inquiry, notes, history, linkedLeadId } = await loadInquiry(params.id);
  if (!inquiry) notFound();

  const propertyTitle = (inquiry.properties as unknown as { title?: string } | null)?.title ?? null;

  return (
    <div>
      <Link href="/admin/inquiries" className="text-xs font-medium text-ink-faint hover:text-ink">
        &larr; Back to Inquiries
      </Link>

      <h1 className="mt-2 font-display text-2xl text-ink">{inquiry.name}</h1>
      <p className="mt-1 text-sm text-ink-faint">
        {inquiry.inquiry_type} · Submitted {formatDate(inquiry.created_at)}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <AdminCard title="Customer & Context">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Email</dt>
                <dd className="text-ink">{inquiry.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Phone</dt>
                <dd className="text-ink">{inquiry.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Property</dt>
                <dd className="text-ink">{propertyTitle || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Message</dt>
                <dd className="whitespace-pre-wrap text-ink">{inquiry.message || "—"}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Status">
            <StatusSelect
              entity="inquiries"
              id={inquiry.id}
              value={inquiry.status}
              options={statusEntities.inquiries.options}
            />
          </AdminCard>
        </div>

        <AdminCard
          title="Notes & Status History"
          description={
            linkedLeadId
              ? undefined
              : "No linked CRM lead was found for this inquiry — notes and status history live on that record."
          }
        >
          {linkedLeadId ? (
            <div className="space-y-6">
              <Link
                href={`/admin/leads/${linkedLeadId}`}
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
