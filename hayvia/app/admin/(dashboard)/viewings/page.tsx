import Link from "next/link";
import { fetchViewings } from "@/lib/admin/crm";
import StatusSelect from "@/components/admin/StatusSelect";
import { statusEntities } from "@/lib/admin/status-config";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminViewingsPage() {
  const viewings = await fetchViewings();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Viewing Requests</h1>
      <p className="mt-1 text-sm text-ink-faint">{viewings.length} viewing requests.</p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-line-soft/60 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Phone / WhatsApp</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Comment</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {viewings.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink-faint">
                  No viewing requests yet.
                </td>
              </tr>
            ) : (
              viewings.map((viewing) => (
                <tr key={viewing.id} className="align-top hover:bg-line-soft/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/viewings/${viewing.id}`}
                      className="font-medium text-ink hover:text-moss-700 hover:underline"
                    >
                      {viewing.customer_name || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{viewing.property_title}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                    {viewing.viewing_type === "VIDEO_CALL" ? "Video Call" : "In-person"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                    {viewing.preferred_date ? formatDate(viewing.preferred_date) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{viewing.preferred_time || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{viewing.customer_phone || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{viewing.customer_email || "—"}</td>
                  <td className="max-w-xs px-4 py-3 text-ink-soft">{viewing.notes || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      entity="viewings"
                      id={viewing.id}
                      value={viewing.status}
                      options={statusEntities.viewings.options}
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
