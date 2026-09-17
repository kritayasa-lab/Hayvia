import Link from "next/link";
import { fetchLeads } from "@/lib/admin/crm";
import StatusSelect from "@/components/admin/StatusSelect";
import { statusEntities } from "@/lib/admin/status-config";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const sourceLabel: Record<string, string> = {
  INQUIRY: "Inquiry",
  SELLER_LEAD: "Seller Lead",
  MATCHING: "Matching",
  GET_MATCHED: "Get Matched",
  MANUAL: "Manual",
  OTHER: "Other",
};

export default async function AdminLeadsPage() {
  const leads = await fetchLeads();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Leads</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Unified CRM queue — every inquiry, viewing lead, matching session, and seller submission in one status pipeline. {leads.length} leads.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-line-soft/60 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-faint">
                  No leads yet.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="align-top hover:bg-line-soft/30">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">{sourceLabel[lead.source_type] ?? lead.source_type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="font-medium text-ink hover:text-moss-700 hover:underline"
                    >
                      {lead.customer_name || "—"}
                    </Link>
                    <p className="text-xs text-ink-faint">
                      {[lead.customer_email, lead.customer_phone].filter(Boolean).join(" · ") || "No contact info"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{lead.property_title || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{lead.lead_type}</td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      entity="leads"
                      id={lead.id}
                      value={lead.status}
                      options={statusEntities.leads.options}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
