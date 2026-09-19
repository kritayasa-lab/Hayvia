import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import StatusSelect from "@/components/admin/StatusSelect";
import { statusEntities } from "@/lib/admin/status-config";
import { formatDate, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Phase 7 — "Approve & Create Property" only makes sense while the lead is
// still active follow-up work; a REJECTED lead was declined, and a
// CONVERTED one already has its property (see convertedProperty below).
const APPROVABLE_STATUSES = new Set(["NEW", "CONTACTED", "QUALIFIED"]);

const contactMethodLabels: Record<string, string> = {
  PHONE: "Phone",
  LINE: "LINE",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

async function loadSellerLead(id: string) {
  const supabase = createAdminClient();

  const { data: sellerLead } = await supabase.from("seller_leads").select("*").eq("id", id).single();
  if (!sellerLead) {
    return { sellerLead: null, notes: [], history: [], linkedLeadId: null, convertedProperty: null };
  }

  // seller_leads has no direct lead_id column — the reverse link lives on
  // leads.seller_lead_id instead. Same best-effort caveat as Inquiries: not
  // every seller lead is guaranteed to have a linked CRM lead row.
  const [{ data: linkedLead }, { data: convertedProperty }] = await Promise.all([
    supabase.from("leads").select("id").eq("seller_lead_id", id).maybeSingle(),
    supabase.from("properties").select("id, title").eq("seller_lead_id", id).maybeSingle(),
  ]);

  if (!linkedLead) {
    return { sellerLead, notes: [], history: [], linkedLeadId: null, convertedProperty };
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

  return {
    sellerLead,
    notes: notes ?? [],
    history: history ?? [],
    linkedLeadId: linkedLead.id as string,
    convertedProperty,
  };
}

export default async function SellerLeadDetailPage({ params }: { params: { id: string } }) {
  const { sellerLead, notes, history, linkedLeadId, convertedProperty } = await loadSellerLead(params.id);
  if (!sellerLead) notFound();

  return (
    <div>
      <Link href="/admin/seller-leads" className="text-xs font-medium text-ink-faint hover:text-ink">
        &larr; Back to Seller Leads
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">{sellerLead.full_name}</h1>
          <p className="mt-1 text-sm text-ink-faint">Submitted {formatDate(sellerLead.created_at)}</p>
        </div>
        {convertedProperty ? (
          <Link
            href={`/admin/properties/${convertedProperty.id}`}
            className="inline-flex items-center justify-center rounded bg-moss-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Converted &rarr; View Property
          </Link>
        ) : (
          APPROVABLE_STATUSES.has(sellerLead.status) && (
            <Link
              href={`/admin/properties/new?fromSellerLead=${sellerLead.id}`}
              className="inline-flex items-center justify-center rounded bg-moss-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Approve &amp; Create Property
            </Link>
          )
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <AdminCard title="Customer & Context">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Email</dt>
                <dd className="text-ink">{sellerLead.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Phone</dt>
                <dd className="text-ink">{sellerLead.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Preferred Contact Method</dt>
                <dd className="text-ink">
                  {sellerLead.preferred_contact_method
                    ? contactMethodLabels[sellerLead.preferred_contact_method] ?? sellerLead.preferred_contact_method
                    : "—"}
                  {sellerLead.preferred_contact_method === "LINE" && sellerLead.line_id && (
                    <span className="text-ink-soft"> · LINE ID: {sellerLead.line_id}</span>
                  )}
                  {sellerLead.preferred_contact_method === "WHATSAPP" && sellerLead.whatsapp_number && (
                    <span className="text-ink-soft"> · WhatsApp: {sellerLead.whatsapp_number}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Property Type</dt>
                <dd className="text-ink">{sellerLead.property_type || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Location</dt>
                <dd className="text-ink">
                  {[sellerLead.district, sellerLead.city, sellerLead.province].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Specs</dt>
                <dd className="text-ink">
                  {[
                    sellerLead.bedrooms !== null ? `${sellerLead.bedrooms} bed` : null,
                    sellerLead.bathrooms !== null ? `${sellerLead.bathrooms} bath` : null,
                    sellerLead.size_sqm !== null ? `${sellerLead.size_sqm} sqm` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Expected Price</dt>
                <dd className="text-ink">
                  {sellerLead.expected_price ? formatPrice(sellerLead.expected_price) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Description</dt>
                <dd className="whitespace-pre-wrap text-ink">{sellerLead.description || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Additional Info</dt>
                <dd className="whitespace-pre-wrap text-ink">{sellerLead.additional_info || "—"}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Status">
            <StatusSelect
              entity="seller-leads"
              id={sellerLead.id}
              value={sellerLead.status}
              options={statusEntities["seller-leads"].options}
            />
          </AdminCard>
        </div>

        <AdminCard
          title="Notes & Status History"
          description={
            linkedLeadId
              ? undefined
              : "No linked CRM lead was found for this seller lead — notes and status history live on that record."
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
