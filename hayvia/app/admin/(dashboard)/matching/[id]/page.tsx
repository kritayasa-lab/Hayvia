import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchMatchingRunDetail } from "@/lib/admin/crm";
import AdminCard from "@/components/admin/AdminCard";
import Badge from "@/components/ui/Badge";
import { formatDate, formatPriceRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function MatchingRequestDetailPage({ params }: { params: { id: string } }) {
  const { preference, customer, matches, hasInquiry, hasViewing } = await fetchMatchingRunDetail(params.id);
  if (!preference) notFound();

  const claimed = Boolean(preference.customer_id);

  return (
    <div>
      <Link href="/admin/matching" className="text-xs font-medium text-ink-faint hover:text-ink">
        &larr; Back to Matching Requests
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">
          {preference.purpose === "BUY" ? "Buy" : "Rent"} Request
        </h1>
        <Badge tone={claimed ? "moss" : "neutral"}>{claimed ? "Claimed" : "Guest / Not yet claimed"}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-faint">
        Request ID {preference.id} · Submitted {formatDate(preference.created_at)}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <AdminCard title="Request">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Buy / Rent</dt>
                <dd className="text-ink">{preference.purpose === "BUY" ? "Buy" : "Rent"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Location</dt>
                <dd className="text-ink">
                  {[preference.district, preference.city, preference.province].filter(Boolean).join(", ") ||
                    "No location preference"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Property Type</dt>
                <dd className="text-ink">{preference.property_type || "Any type"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Budget</dt>
                <dd className="text-ink">
                  {preference.budget_min || preference.budget_max
                    ? formatPriceRange(preference.budget_min ?? 0, preference.budget_max ?? undefined)
                    : "No preference"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Bedrooms</dt>
                <dd className="text-ink">{preference.bedrooms ?? "Any"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Bathrooms</dt>
                <dd className="text-ink">{preference.bathrooms ?? "Any"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Furnished</dt>
                <dd className="text-ink">{preference.furnished ? titleCase(preference.furnished) : "No preference"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Parking</dt>
                <dd className="text-ink">{preference.parking ? "Required" : "Not important"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Minimum Size</dt>
                <dd className="text-ink">{preference.min_size_sqm ? `${preference.min_size_sqm} sqm` : "No preference"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Lifestyle</dt>
                <dd className="text-ink">
                  {preference.lifestyle_preferences.length > 0
                    ? preference.lifestyle_preferences.map(titleCase).join(", ")
                    : "No preference"}
                </dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Activity">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-ink">
                <span className="text-moss-600">✓</span> Matching completed
              </li>
              <li className="flex items-center gap-2 text-ink">
                <span className={claimed ? "text-moss-600" : "text-ink-faint"}>{claimed ? "✓" : "○"}</span>
                Customer identified {claimed ? "& details unlocked" : ""}
              </li>
              <li className="flex items-center gap-2 text-ink">
                <span className={hasInquiry ? "text-moss-600" : "text-ink-faint"}>{hasInquiry ? "✓" : "○"}</span>
                Inquiry
              </li>
              <li className="flex items-center gap-2 text-ink">
                <span className={hasViewing ? "text-moss-600" : "text-ink-faint"}>{hasViewing ? "✓" : "○"}</span>
                Viewing
              </li>
            </ul>
            {claimed && (
              <p className="mt-3 text-xs text-ink-faint">
                Inquiry/viewing status reflects this customer&apos;s overall activity, not only these matched
                properties.
              </p>
            )}
          </AdminCard>
        </div>

        <div className="space-y-6">
          <AdminCard title="Customer">
            {customer ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">Name</dt>
                  <dd className="text-ink">{customer.full_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">Email</dt>
                  <dd className="text-ink">
                    {customer.email || "—"}{" "}
                    {customer.email && (
                      <Badge tone={customer.email_verified ? "moss" : "neutral"} className="ml-1">
                        {customer.email_verified ? "Verified" : "Unverified"}
                      </Badge>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">Phone</dt>
                  <dd className="text-ink">
                    {customer.phone || "—"}{" "}
                    {customer.phone && (
                      <Badge tone={customer.phone_verified ? "moss" : "neutral"} className="ml-1">
                        {customer.phone_verified ? "Verified" : "Unverified"}
                      </Badge>
                    )}
                  </dd>
                </div>
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="inline-block text-sm font-medium text-moss-700 hover:underline"
                >
                  View Customer →
                </Link>
              </dl>
            ) : (
              <p className="text-sm text-ink-faint">
                Guest / Not yet claimed — this request hasn&apos;t been linked to an authenticated customer yet.
              </p>
            )}
          </AdminCard>

          <AdminCard title="Top Matches" description={`${matches.length} match${matches.length === 1 ? "" : "es"}`}>
            {matches.length === 0 ? (
              <p className="text-sm text-ink-faint">No matches were found for this request.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {matches.map((match) => (
                  <li key={match.propertyId} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{match.propertyTitle}</p>
                      <p className="text-xs font-medium text-moss-700">{match.score}% match</p>
                    </div>
                    {match.propertySlug && (
                      <Link
                        href={`/properties/${match.propertySlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-medium text-moss-700 hover:underline"
                      >
                        View Property
                      </Link>
                    )}
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
