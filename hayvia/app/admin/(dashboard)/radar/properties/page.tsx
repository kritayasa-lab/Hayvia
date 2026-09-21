import Link from "next/link";
import { Plus, Search } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatDate, formatPrice } from "@/lib/utils";
import { statusEntities } from "@/lib/admin/status-config";
import { fetchRadarPropertyCandidates } from "@/lib/admin/radar-properties";

export const dynamic = "force-dynamic";

const statusTone: Record<string, "moss" | "clay" | "neutral"> = {
  DISCOVERED: "neutral",
  AI_REVIEWED: "neutral",
  QUALIFIED: "moss",
  DISMISSED: "neutral",
  DUPLICATE: "neutral",
  EXPIRED: "neutral",
  CONTACT_PENDING: "clay",
  CONTACTED: "clay",
  OWNER_INTERESTED: "moss",
  OWNER_DECLINED: "neutral",
  INFO_COLLECTION: "clay",
  CONVERTED: "moss",
};

const ALL_STATUSES = [...statusEntities["radar-property-candidates"].options, "DUPLICATE", "CONVERTED"];

// Phase 8D-2 — evidence-based acquisition classification. Tone mirrors the
// business goal: an open opportunity for Subphiphat reads as moss, a closed
// one as clay, unclassified/unclear as neutral (never presented as "bad" —
// it just hasn't been analyzed, or the evidence wasn't there either way).
const acquisitionTone: Record<string, "moss" | "clay" | "neutral"> = {
  OWNER_DIRECT: "moss",
  OPEN_CO_BROKER: "moss",
  AGENT_ONLY: "clay",
  UNKNOWN: "neutral",
};

const ACQUISITION_TYPES = ["OWNER_DIRECT", "OPEN_CO_BROKER", "AGENT_ONLY", "UNKNOWN"];

export default async function RadarPropertiesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; acquisitionType?: string };
}) {
  const rows = await fetchRadarPropertyCandidates({
    q: searchParams.q,
    status: searchParams.status,
    acquisitionType: searchParams.acquisitionType,
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Property Radar</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Discovered property candidates — staging data, not real properties. {rows.length} shown.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-wrap items-center gap-2" action="/admin/radar/properties">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              name="q"
              defaultValue={searchParams.q}
              placeholder="Search RADAR-P code, city, district..."
              className="w-72 rounded border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/30"
            />
          </div>
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
          <select
            name="acquisitionType"
            defaultValue={searchParams.acquisitionType || ""}
            className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/30"
          >
            <option value="">All acquisition types</option>
            {ACQUISITION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
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
          href="/admin/radar/properties/new"
          className="flex items-center gap-1.5 rounded bg-moss-600 px-4 py-2 text-sm font-medium text-white hover:bg-moss-700"
        >
          <Plus size={15} /> Add Property Candidate
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-line-soft/60 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Candidate Code</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Poster / Acquisition</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Beds</th>
              <th className="px-4 py-3 font-medium">Discovered</th>
              <th className="px-4 py-3 font-medium">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-ink-faint">
                  No Property Radar candidates found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-line-soft/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/radar/properties/${row.id}`}
                      className="font-mono text-xs font-medium text-ink hover:text-moss-700 hover:underline"
                    >
                      {row.candidate_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[row.status] ?? "neutral"}>{row.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {row.poster_type || row.acquisition_type ? (
                      <div className="flex flex-wrap gap-1">
                        {row.poster_type && <Badge tone="neutral">{row.poster_type}</Badge>}
                        {row.acquisition_type && (
                          <Badge tone={acquisitionTone[row.acquisition_type] ?? "neutral"}>
                            {row.acquisition_type.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-faint">Not analyzed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{row.source_type || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {[row.district, row.city, row.province].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{row.property_type || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{row.price != null ? formatPrice(row.price) : "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{row.bedrooms ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatDate(row.discovered_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatDate(row.last_seen_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
