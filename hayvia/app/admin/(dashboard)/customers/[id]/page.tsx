import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import Badge from "@/components/ui/Badge";
import { formatDate, formatPriceRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

const firstSeenLabel: Record<string, string> = {
  INQUIRY: "Inquiry",
  VIEWING: "Viewing Request",
  MATCHING: "Matching",
  SELLER_LEAD: "Seller Lead",
  ACCOUNT: "Account",
};

const leadSourceLabel: Record<string, string> = {
  INQUIRY: "Inquiry",
  SELLER_LEAD: "Seller Lead",
  MATCHING: "Matching",
  GET_MATCHED: "Get Matched",
  MANUAL: "Manual",
  OTHER: "Other",
};

async function loadCustomer(id: string) {
  const supabase = createAdminClient();

  const [{ data: customer }, { data: leads }, { data: inquiries }, { data: viewings }, { data: matchingPreferences }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase
        .from("leads")
        .select("id, source_type, lead_type, status, created_at, properties(title)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("inquiries")
        .select("id, inquiry_type, status, created_at, properties(title)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("viewings")
        .select("id, viewing_type, status, preferred_date, created_at, properties(title)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("matching_preferences")
        .select("id, purpose, budget_min, budget_max, province, city, district, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
    ]);

  return {
    customer,
    leads: leads ?? [],
    inquiries: inquiries ?? [],
    viewings: viewings ?? [],
    matchingPreferences: matchingPreferences ?? [],
  };
}

function propertyTitle(row: { properties: unknown }): string {
  return (row.properties as unknown as { title?: string } | null)?.title ?? "—";
}

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { customer, leads, inquiries, viewings, matchingPreferences } = await loadCustomer(params.id);
  if (!customer) notFound();

  return (
    <div>
      <Link href="/admin/customers" className="text-xs font-medium text-ink-faint hover:text-ink">
        &larr; Back to Customers
      </Link>

      <h1 className="mt-2 font-display text-2xl text-ink">{customer.full_name || "Unnamed Customer"}</h1>
      <p className="mt-1 text-sm text-ink-faint">Customer since {formatDate(customer.created_at)}</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <AdminCard title="Customer Identity">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Email</dt>
                <dd className="text-ink">{customer.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Phone</dt>
                <dd className="text-ink">{customer.phone || "—"}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Verification Status">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Email</dt>
                <dd>
                  <Badge tone={customer.email_verified ? "moss" : "neutral"}>
                    {customer.email_verified ? "Verified" : "Unverified"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Phone</dt>
                <dd>
                  <Badge tone={customer.phone_verified ? "moss" : "neutral"}>
                    {customer.phone_verified ? "Verified" : "Unverified"}
                  </Badge>
                </dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="First Seen">
            <p className="text-sm text-ink">
              {customer.first_seen_source
                ? firstSeenLabel[customer.first_seen_source] ?? customer.first_seen_source
                : "—"}
            </p>
          </AdminCard>
        </div>

        <div className="space-y-6">
          <AdminCard title="Leads" description={`${leads.length} lead${leads.length === 1 ? "" : "s"}`}>
            {leads.length === 0 ? (
              <p className="text-sm text-ink-faint">No leads yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {leads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">
                        {leadSourceLabel[lead.source_type] ?? lead.source_type} · {lead.lead_type} ·{" "}
                        {propertyTitle(lead)}
                      </p>
                      <p className="text-xs text-ink-faint">
                        <Badge tone="neutral">{lead.status}</Badge> · {formatDate(lead.created_at)}
                      </p>
                    </div>
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="shrink-0 text-xs font-medium text-moss-700 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard
            title="Inquiries"
            description={`${inquiries.length} inquir${inquiries.length === 1 ? "y" : "ies"}`}
          >
            {inquiries.length === 0 ? (
              <p className="text-sm text-ink-faint">No inquiries yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {inquiries.map((inquiry) => (
                  <li key={inquiry.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">
                        {inquiry.inquiry_type} · {propertyTitle(inquiry)}
                      </p>
                      <p className="text-xs text-ink-faint">
                        <Badge tone="neutral">{inquiry.status}</Badge> · {formatDate(inquiry.created_at)}
                      </p>
                    </div>
                    <Link
                      href={`/admin/inquiries/${inquiry.id}`}
                      className="shrink-0 text-xs font-medium text-moss-700 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard
            title="Viewing Requests"
            description={`${viewings.length} viewing request${viewings.length === 1 ? "" : "s"}`}
          >
            {viewings.length === 0 ? (
              <p className="text-sm text-ink-faint">No viewing requests yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {viewings.map((viewing) => (
                  <li key={viewing.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">
                        {viewing.viewing_type === "VIDEO_CALL" ? "Video Call" : "In-person"} ·{" "}
                        {propertyTitle(viewing)}
                      </p>
                      <p className="text-xs text-ink-faint">
                        <Badge tone="neutral">{viewing.status}</Badge>
                        {viewing.preferred_date && ` · ${formatDate(viewing.preferred_date)}`} ·{" "}
                        {formatDate(viewing.created_at)}
                      </p>
                    </div>
                    <Link
                      href={`/admin/viewings/${viewing.id}`}
                      className="shrink-0 text-xs font-medium text-moss-700 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard
            title="Matching Preferences"
            description={
              matchingPreferences.length === 0
                ? undefined
                : `${matchingPreferences.length} matching request${matchingPreferences.length === 1 ? "" : "s"}`
            }
          >
            {matchingPreferences.length === 0 ? (
              <p className="text-sm text-ink-faint">No matching requests yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {matchingPreferences.map((pref) => (
                  <li key={pref.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {pref.purpose === "BUY" ? "Buy" : "Rent"} ·{" "}
                        {[pref.district, pref.city, pref.province].filter(Boolean).join(", ") ||
                          "No location preference"}
                      </p>
                      {(pref.budget_min || pref.budget_max) && (
                        <p className="text-xs text-ink-faint">
                          Budget: {formatPriceRange(pref.budget_min ?? 0, pref.budget_max ?? undefined)}
                        </p>
                      )}
                      <p className="text-xs text-ink-faint">{formatDate(pref.created_at)}</p>
                    </div>
                    <Link
                      href={`/admin/matching/${pref.id}`}
                      className="shrink-0 text-xs font-medium text-moss-700 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
