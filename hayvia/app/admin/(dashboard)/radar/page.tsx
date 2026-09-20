import Link from "next/link";
import { Radar as RadarIcon, Building2, Users, Clock3, Plus } from "lucide-react";
import StatCard from "@/components/admin/StatCard";
import AdminCard from "@/components/admin/AdminCard";
import Badge from "@/components/ui/Badge";
import { fetchRadarOverview, type RadarCandidateSummary } from "@/lib/admin/radar";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const propertyStatusLabels: { key: keyof Awaited<ReturnType<typeof fetchRadarOverview>>["propertyStatusCounts"]; label: string }[] = [
  { key: "DISCOVERED", label: "New" },
  { key: "AI_REVIEWED", label: "AI Reviewed" },
  { key: "QUALIFIED", label: "Qualified" },
  { key: "CONTACT_PENDING", label: "Contact Pending" },
  { key: "OWNER_INTERESTED", label: "Owner Interested" },
  { key: "CONVERTED", label: "Converted" },
];

// Phase 8B built the foundation (schema + this read-only overview). Phase
// 8C adds the first real Property Radar workflow — manual intake, review,
// and conversion live at /admin/radar/properties/*. Lead Radar remains
// foundation-only (counts here, no workflow yet) — Property Radar and Lead
// Radar are always shown as two separate lists, never merged into one
// ambiguous feed, matching the two separate status enums/history tables at
// the database layer.
export default async function AdminRadarPage() {
  const data = await fetchRadarOverview();

  return (
    <div>
      <div className="flex items-center gap-2">
        <RadarIcon size={22} className="text-moss-600" />
        <h1 className="font-display text-2xl text-ink">Radar</h1>
      </div>
      <p className="mt-1 text-sm text-ink-faint">
        Staging/intelligence layer for external property and demand discovery. Radar candidates are
        not real properties or CRM leads until a human reviews and approves them.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Property Candidates"
          value={data.propertyCandidateCount}
          href="/admin/radar/properties"
          icon={<Building2 size={16} />}
        />
        <StatCard label="Lead Candidates" value={data.leadCandidateCount} icon={<Users size={16} />} />
        <StatCard
          label="Property — Awaiting Review"
          value={data.propertyAwaitingReviewCount}
          href="/admin/radar/properties"
          icon={<Clock3 size={16} />}
          tone="accent"
        />
        <StatCard
          label="Lead — Awaiting Review"
          value={data.leadAwaitingReviewCount}
          icon={<Clock3 size={16} />}
          tone="accent"
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink">Property Radar Pipeline</h2>
        <Link
          href="/admin/radar/properties/new"
          className="flex items-center gap-1.5 rounded bg-moss-600 px-4 py-2 text-sm font-medium text-white hover:bg-moss-700"
        >
          <Plus size={15} /> Add Property Candidate
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {propertyStatusLabels.map(({ key, label }) => (
          <StatCard
            key={key}
            label={label}
            value={data.propertyStatusCounts[key]}
            href="/admin/radar/properties"
          />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminCard title="Property Radar" description="Recently discovered candidates.">
          <CandidateList
            items={data.recentPropertyCandidates}
            emptyLabel="No property candidates yet."
            hrefBase="/admin/radar/properties"
          />
        </AdminCard>

        <AdminCard title="Lead Radar" description="Recently discovered candidates.">
          <CandidateList items={data.recentLeadCandidates} emptyLabel="No lead candidates yet." />
        </AdminCard>

        <AdminCard title="Recently Qualified — Property" description="Ready for the next review step.">
          <CandidateList
            items={data.recentlyQualifiedProperty}
            emptyLabel="No qualified property candidates yet."
            hrefBase="/admin/radar/properties"
          />
        </AdminCard>

        <AdminCard title="Recently Qualified — Lead" description="Ready for the next review step.">
          <CandidateList items={data.recentlyQualifiedLead} emptyLabel="No qualified lead candidates yet." />
        </AdminCard>
      </div>
    </div>
  );
}

function CandidateList({
  items,
  emptyLabel,
  hrefBase,
}: {
  items: RadarCandidateSummary[];
  emptyLabel: string;
  /** When set, each candidate code links to its detail page (Property Radar only, in Phase 8C). */
  hrefBase?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-faint">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            {hrefBase ? (
              <Link
                href={`${hrefBase}/${item.id}`}
                className="truncate text-sm font-medium text-ink hover:text-moss-700 hover:underline"
              >
                {item.candidateCode}
              </Link>
            ) : (
              <p className="truncate text-sm font-medium text-ink">{item.candidateCode}</p>
            )}
            <p className="truncate text-xs text-ink-faint">{item.title}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge tone="neutral">{item.status}</Badge>
            <p className="text-xs text-ink-faint">{formatDate(item.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
