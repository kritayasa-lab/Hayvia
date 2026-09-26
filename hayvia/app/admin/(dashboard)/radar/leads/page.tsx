import Link from "next/link";
import { Search } from "lucide-react";
import Badge from "@/components/ui/Badge";
import ClickableTableRow from "@/components/admin/ClickableTableRow";
import { formatDate, formatPrice } from "@/lib/utils";
import { fetchRadarLeadCandidates } from "@/lib/admin/radar-leads";

export const dynamic = "force-dynamic";

// radar_lead_status_enum (20260920160000_radar_foundation.sql), shown as
// filter options only — this MVP list page has no status-change dropdown
// (see this page's own scope note below).
const ALL_STATUSES = [
  "DISCOVERED",
  "AI_REVIEWED",
  "QUALIFIED",
  "DISMISSED",
  "CONTACT_PENDING",
  "CONTACTED",
  "RESPONDED",
  "QUALIFIED_LEAD",
  "CONVERTED",
  "UNRESPONSIVE",
  "INVALID",
  "DUPLICATE",
  "EXPIRED",
];

const LEAD_CATEGORIES = ["BUYER", "RENTER", "SELLER", "NOISE"];

const statusTone: Record<string, "moss" | "clay" | "neutral"> = {
  DISCOVERED: "neutral",
  AI_REVIEWED: "neutral",
  QUALIFIED: "moss",
  QUALIFIED_LEAD: "moss",
  CONVERTED: "moss",
  DISMISSED: "neutral",
  DUPLICATE: "neutral",
  EXPIRED: "neutral",
  INVALID: "neutral",
  UNRESPONSIVE: "neutral",
  CONTACT_PENDING: "clay",
  CONTACTED: "clay",
  RESPONDED: "clay",
};

const categoryTone: Record<string, "moss" | "clay" | "neutral"> = {
  BUYER: "moss",
  RENTER: "moss",
  SELLER: "clay",
  NOISE: "neutral",
};

const leadQualityTone: Record<string, "moss" | "clay" | "neutral"> = {
  STRONG_INTENT: "moss",
  PROBABLE_INTENT: "moss",
  WEAK_INTENT: "clay",
  NOISE_SPAM: "neutral",
};

export default async function RadarLeadsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; category?: string };
}) {
  const rows = await fetchRadarLeadCandidates({
    q: searchParams.q,
    status: searchParams.status,
    leadCategory: searchParams.category,
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Lead Radar</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Discovered lead candidates — staging data, not real CRM leads. {rows.length} shown.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-wrap items-center gap-2" action="/admin/radar/leads">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              name="q"
              defaultValue={searchParams.q}
              placeholder="Search RADAR-L code, city, district..."
              className="w-72 rounded border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/30"
            />
          </div>
          <select
            name="category"
            defaultValue={searchParams.category || ""}
            className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/30"
          >
            <option value="">All categories</option>
            {LEAD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={searchParams.status || ""}
            className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/30"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:border-ink/20 hover:text-ink"
          >
            Search
          </button>
        </form>
        <Link
          href="/admin/radar/leads/import"
          className="rounded bg-moss-600 px-4 py-2 text-sm font-medium text-white hover:bg-moss-700"
        >
          Import Apify Dataset
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="bg-line-soft/60 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Candidate Code</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Lead Quality</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Budget</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium">Discovered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink-faint">
                  No Lead Radar candidates found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <ClickableTableRow
                  key={row.id}
                  href={`/admin/radar/leads/${row.id}`}
                  className="cursor-pointer align-top hover:bg-line-soft/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/radar/leads/${row.id}`}
                      className="font-mono text-xs font-medium text-ink hover:text-moss-700 hover:underline"
                    >
                      {row.candidate_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {row.lead_category ? (
                      <Badge tone={categoryTone[row.lead_category] ?? "neutral"}>{row.lead_category}</Badge>
                    ) : (
                      <span className="text-ink-faint">Not classified</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[row.status] ?? "neutral"}>{row.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {row.leadQuality ? (
                      <Badge tone={leadQualityTone[row.leadQuality] ?? "neutral"}>{row.leadQuality.replace(/_/g, " ")}</Badge>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {[row.district, row.city, row.province].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{row.property_type || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {row.budget_min != null || row.budget_max != null
                      ? `${row.budget_min != null ? formatPrice(row.budget_min) : "?"} – ${
                          row.budget_max != null ? formatPrice(row.budget_max) : "?"
                        }`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{row.confidence != null ? `${row.confidence}%` : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatDate(row.discovered_at)}</td>
                </ClickableTableRow>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
