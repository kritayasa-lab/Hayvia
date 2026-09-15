import { fetchInquiries } from "@/lib/admin/crm";
import StatusSelect from "@/components/admin/StatusSelect";
import { statusEntities } from "@/lib/admin/status-config";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  const inquiries = await fetchInquiries();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Inquiries</h1>
      <p className="mt-1 text-sm text-ink-faint">{inquiries.length} inquiries.</p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-line-soft/60 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone / WhatsApp</th>
              <th className="px-4 py-3 font-medium">Requirements</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {inquiries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-faint">
                  No inquiries yet.
                </td>
              </tr>
            ) : (
              inquiries.map((inquiry) => (
                <tr key={inquiry.id} className="align-top hover:bg-line-soft/30">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(inquiry.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{inquiry.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{inquiry.property_title}</td>
                  <td className="px-4 py-3 text-ink-soft">{inquiry.email || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{inquiry.phone || "—"}</td>
                  <td className="max-w-xs px-4 py-3 text-ink-soft">{inquiry.message || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      entity="inquiries"
                      id={inquiry.id}
                      value={inquiry.status}
                      options={statusEntities.inquiries.options}
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
