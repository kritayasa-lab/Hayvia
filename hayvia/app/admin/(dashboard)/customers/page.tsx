import Link from "next/link";
import { fetchCustomers } from "@/lib/admin/customers";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const firstSeenLabel: Record<string, string> = {
  INQUIRY: "Inquiry",
  VIEWING: "Viewing Request",
  MATCHING: "Matching",
  SELLER_LEAD: "Seller Lead",
  ACCOUNT: "Account",
};

export default async function AdminCustomersPage() {
  const customers = await fetchCustomers();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Customers</h1>
      <p className="mt-1 text-sm text-ink-faint">
        One record per real person, across every Lead, Inquiry, Viewing Request, and Matching
        Request they&apos;ve submitted — guests included, no account required. {customers.length} customers.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-line-soft/60 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email Verified</th>
              <th className="px-4 py-3 font-medium">Phone Verified</th>
              <th className="px-4 py-3 font-medium">First Seen</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-faint">
                  No customers yet.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="align-top hover:bg-line-soft/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="font-medium text-ink hover:text-moss-700 hover:underline"
                    >
                      {customer.full_name || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{customer.email || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{customer.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={customer.email_verified ? "moss" : "neutral"}>
                      {customer.email_verified ? "Verified" : "Unverified"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={customer.phone_verified ? "moss" : "neutral"}>
                      {customer.phone_verified ? "Verified" : "Unverified"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {customer.first_seen_source
                      ? firstSeenLabel[customer.first_seen_source] ?? customer.first_seen_source
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(customer.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
