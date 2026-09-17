import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import Badge from "@/components/ui/Badge";
import StatusSelect from "@/components/admin/StatusSelect";
import { TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import { statusEntities } from "@/lib/admin/status-config";
import { formatDate } from "@/lib/utils";
import { addLeadNote } from "@/app/admin/(dashboard)/leads/[id]/actions";

export const dynamic = "force-dynamic";

const sourceLabel: Record<string, string> = {
  INQUIRY: "Inquiry",
  SELLER_LEAD: "Seller Lead",
  MATCHING: "Matching",
  GET_MATCHED: "Get Matched",
  MANUAL: "Manual",
  OTHER: "Other",
};

async function loadLead(id: string) {
  const supabase = createAdminClient();

  const [{ data: lead }, { data: notes }, { data: history }] = await Promise.all([
    supabase.from("leads").select("*, properties(title)").eq("id", id).single(),
    supabase
      .from("lead_notes")
      .select("id, note, created_at, profiles(full_name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_status_history")
      .select("id, from_status, to_status, changed_at, note, profiles(full_name)")
      .eq("lead_id", id)
      .order("changed_at", { ascending: false }),
  ]);

  return { lead, notes: notes ?? [], history: history ?? [] };
}

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const { lead, notes, history } = await loadLead(params.id);
  if (!lead) notFound();

  const propertyTitle = (lead.properties as unknown as { title?: string } | null)?.title ?? null;

  return (
    <div>
      <Link href="/admin/leads" className="text-xs font-medium text-ink-faint hover:text-ink">
        &larr; Back to Leads
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">{lead.customer_name || "Unnamed Lead"}</h1>
        <Badge tone="neutral">{sourceLabel[lead.source_type] ?? lead.source_type}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-faint">
        {lead.lead_type} · Submitted {formatDate(lead.created_at)}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <AdminCard title="Customer & Context">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Name</dt>
                <dd className="text-ink">{lead.customer_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Email</dt>
                <dd className="text-ink">{lead.customer_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Phone</dt>
                <dd className="text-ink">{lead.customer_phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Property</dt>
                <dd className="text-ink">{propertyTitle || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Follow-up Date</dt>
                <dd className="text-ink">{lead.follow_up_date ? formatDate(lead.follow_up_date) : "—"}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Status">
            <StatusSelect
              entity="leads"
              id={lead.id}
              value={lead.status}
              options={statusEntities.leads.options}
            />
          </AdminCard>

          <AdminCard title="Status History">
            {history.length === 0 ? (
              <p className="text-sm text-ink-faint">No status changes recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((row) => (
                  <li key={row.id} className="text-sm">
                    <p className="text-ink">
                      {row.from_status ? `${row.from_status} → ${row.to_status}` : `Set to ${row.to_status}`}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {formatDate(row.changed_at)}
                      {(row.profiles as unknown as { full_name?: string } | null)?.full_name &&
                        ` · ${(row.profiles as unknown as { full_name?: string }).full_name}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        <AdminCard title="Notes">
          <form action={addLeadNote.bind(null, lead.id)} className="space-y-3">
            <TextArea name="note" placeholder="Add a note about this lead..." required />
            <SubmitButton pendingLabel="Saving...">Add Note</SubmitButton>
          </form>

          <div className="mt-6 space-y-4 border-t border-line-soft pt-4">
            {notes.length === 0 ? (
              <p className="text-sm text-ink-faint">No notes yet.</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="rounded border border-line-soft p-3">
                  <p className="whitespace-pre-wrap text-sm text-ink">{n.note}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {formatDate(n.created_at)}
                    {(n.profiles as unknown as { full_name?: string } | null)?.full_name &&
                      ` · ${(n.profiles as unknown as { full_name?: string }).full_name}`}
                  </p>
                </div>
              ))
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
