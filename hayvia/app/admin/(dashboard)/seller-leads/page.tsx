import { fetchSellerLeads } from "@/lib/admin/crm";
import StatusSelect from "@/components/admin/StatusSelect";
import { statusEntities } from "@/lib/admin/status-config";
import { formatDate, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSellerLeadsPage() {
  const leads = await fetchSellerLeads();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Seller Leads</h1>
      <p className="mt-1 text-sm text-ink-faint">
        &ldquo;Sell Your Property&rdquo; submissions. Approve and create a listing from Properties → New once qualified. {leads.length} submissions.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-line-soft/60 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Expected Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-faint">
                  No seller leads yet.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="align-top hover:bg-line-soft/30">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(lead.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{lead.full_name}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    <p>{lead.email}</p>
                    <p>{lead.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {lead.property_type || "—"}
                    {lead.bedrooms !== null && ` · ${lead.bedrooms} bed`}
                    {lead.size_sqm !== null && ` · ${lead.size_sqm} sqm`}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {[lead.district, lead.city, lead.province].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {lead.expected_price ? formatPrice(lead.expected_price) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      entity="seller-leads"
                      id={lead.id}
                      value={lead.status}
                      options={statusEntities["seller-leads"].options}
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
