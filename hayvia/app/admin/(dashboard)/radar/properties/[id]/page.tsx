import { notFound } from "next/navigation";
import Link from "next/link";
import AdminCard from "@/components/admin/AdminCard";
import StatusSelect from "@/components/admin/StatusSelect";
import Badge from "@/components/ui/Badge";
import { statusEntities } from "@/lib/admin/status-config";
import { formatDate, formatPrice } from "@/lib/utils";
import { fetchRadarPropertyCandidateDetail } from "@/lib/admin/radar-properties";
import { markDuplicate, runAiAnalysisAction } from "@/app/admin/(dashboard)/radar/properties/actions";

export const dynamic = "force-dynamic";

// Convertible only once the owner has actually confirmed interest, per the
// Phase 8C pipeline (... -> Contact Owner -> Owner Interested -> Info
// Collection -> Convert). QUALIFIED alone is deliberately excluded — that
// only means "worth pursuing," not "ready to become a listing."
const APPROVABLE_STATUSES = new Set(["OWNER_INTERESTED", "INFO_COLLECTION"]);

const TERMINAL_STATUSES = new Set(["DUPLICATE", "CONVERTED"]);

const dupErrorMessages: Record<string, string> = {
  missing: "Please enter the other candidate's code.",
  notfound: "No candidate with that code was found.",
  self: "A candidate can't be marked a duplicate of itself.",
};

export default async function RadarPropertyCandidateDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string; aiStatus?: string; dupError?: string };
}) {
  const detail = await fetchRadarPropertyCandidateDetail(params.id);
  if (!detail) notFound();

  const { candidate, source, raw, analyses, history, duplicateOf, convertedProperty } = detail;
  const latestAnalysis = analyses[0] ?? null;

  return (
    <div>
      <Link href="/admin/radar/properties" className="text-xs font-medium text-ink-faint hover:text-ink">
        &larr; Back to Property Radar
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl text-ink">{candidate.candidate_code}</h1>
            <Badge tone="neutral">{(candidate.status as string).replace(/_/g, " ")}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-faint">
            Discovered {formatDate(candidate.discovered_at as string)} · Last seen{" "}
            {formatDate(candidate.last_seen_at as string)}
          </p>
        </div>

        {convertedProperty ? (
          <Link
            href={`/admin/properties/${convertedProperty.id}`}
            className="inline-flex items-center justify-center rounded bg-moss-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Converted &rarr; View Property ({convertedProperty.property_code})
          </Link>
        ) : (
          APPROVABLE_STATUSES.has(candidate.status as string) && (
            <Link
              href={`/admin/properties/new?fromRadarCandidate=${candidate.id}`}
              className="inline-flex items-center justify-center rounded bg-moss-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Approve &amp; Create Property
            </Link>
          )
        )}
      </div>

      {searchParams.created === "1" && (
        <p className="mt-4 rounded border border-moss-100 bg-moss-50 px-3.5 py-2.5 text-sm text-moss-700">
          Candidate created.
        </p>
      )}
      {searchParams.aiStatus === "not_configured" && (
        <p className="mt-4 rounded border border-clay-200 bg-clay-50 px-3.5 py-2.5 text-sm text-ink">
          AI analysis provider is not configured yet.
        </p>
      )}
      {searchParams.dupError && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
          {dupErrorMessages[searchParams.dupError] || "Could not mark as duplicate."}
        </p>
      )}
      {duplicateOf && (
        <p className="mt-4 rounded border border-line-soft bg-line-soft/40 px-3.5 py-2.5 text-sm text-ink-soft">
          Marked duplicate of{" "}
          <Link href={`/admin/radar/properties/${duplicateOf.id}`} className="font-medium text-moss-700 hover:underline">
            {duplicateOf.candidate_code}
          </Link>
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <AdminCard title="Source">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Type</dt>
                <dd className="text-ink">{source?.source_type || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">URL</dt>
                <dd className="break-all text-ink">
                  {candidate.source_url ? (
                    <a
                      href={candidate.source_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-moss-700 hover:underline"
                    >
                      {candidate.source_url as string}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Source identifier</dt>
                <dd className="text-ink">{(candidate.source_identifier as string) || "—"}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Property Facts">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Property Type</dt>
                <dd className="text-ink">{(candidate.property_type as string) || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Location</dt>
                <dd className="text-ink">
                  {[candidate.district, candidate.city, candidate.province]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Price</dt>
                <dd className="text-ink">
                  {candidate.price != null ? formatPrice(candidate.price as number) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Specs</dt>
                <dd className="text-ink">
                  {[
                    candidate.bedrooms != null ? `${candidate.bedrooms} bed` : null,
                    candidate.bathrooms != null ? `${candidate.bathrooms} bath` : null,
                    candidate.size_sqm != null ? `${candidate.size_sqm} sqm` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Description</dt>
                <dd className="whitespace-pre-wrap text-ink">{(candidate.description as string) || "—"}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Raw Evidence" description="Admin-only. Preserved exactly as submitted.">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-moss-700">
                Show raw evidence
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded bg-line-soft/40 p-3 text-xs text-ink-soft">
                {raw ? JSON.stringify(raw.raw_payload, null, 2) : "No raw record linked."}
              </pre>
              {raw?.content_fingerprint && (
                <p className="mt-2 text-xs text-ink-faint">Fingerprint: {raw.content_fingerprint}</p>
              )}
            </details>
          </AdminCard>

          <AdminCard title="Status">
            {TERMINAL_STATUSES.has(candidate.status as string) ? (
              <p className="text-sm text-ink-soft">
                This candidate is <strong>{(candidate.status as string).replace(/_/g, " ")}</strong> — a
                terminal state, not changeable from here.
              </p>
            ) : (
              <StatusSelect
                entity="radar-property-candidates"
                id={candidate.id}
                value={candidate.status as string}
                options={statusEntities["radar-property-candidates"].options}
              />
            )}
          </AdminCard>

          {!TERMINAL_STATUSES.has(candidate.status as string) && (
            <AdminCard title="Mark Duplicate" description="Links this candidate to an existing one and closes it.">
              <form action={markDuplicate.bind(null, candidate.id)} className="flex gap-2">
                <input
                  type="text"
                  name="duplicate_of_code"
                  placeholder="RADAR-P-000123"
                  className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/30"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:border-ink/20 hover:text-ink"
                >
                  Mark Duplicate
                </button>
              </form>
            </AdminCard>
          )}
        </div>

        <div className="space-y-6">
          <AdminCard
            title="AI Analysis"
            description={
              analyses.length > 1 ? `${analyses.length} versions` : undefined
            }
            action={
              <form action={runAiAnalysisAction.bind(null, candidate.id)}>
                <button
                  type="submit"
                  className="rounded border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-ink/20 hover:text-ink"
                >
                  Run AI Analysis
                </button>
              </form>
            }
          >
            {latestAnalysis ? (
              <div className="space-y-4">
                <p className="text-xs text-ink-faint">
                  Version {latestAnalysis.version} · {formatDate(latestAnalysis.created_at)}
                  {latestAnalysis.model_name && ` · ${latestAnalysis.model_name}`}
                  {latestAnalysis.confidence != null && ` · Confidence ${latestAnalysis.confidence}%`}
                </p>
                <AnalysisBlock label="Facts" value={latestAnalysis.facts} tone="moss" />
                <AnalysisBlock label="AI Inference" value={latestAnalysis.ai_inference} tone="clay" />
                <AnalysisBlock label="Unknown" value={latestAnalysis.unknowns} tone="neutral" />
                <AnalysisBlock label="Evidence" value={latestAnalysis.evidence} tone="neutral" />
                {latestAnalysis.human_override && (
                  <AnalysisBlock label="Human Override" value={latestAnalysis.human_override} tone="neutral" />
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-faint">
                No analysis has been run yet. AI analysis provider is not configured yet — running it will
                clearly report that rather than fabricate a result.
              </p>
            )}
          </AdminCard>

          <AdminCard title="Status History">
            {history.length === 0 ? (
              <p className="text-sm text-ink-faint">No status changes recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((row) => (
                  <li key={row.id} className="text-sm">
                    <p className="text-ink">
                      {row.from_status ? `${row.from_status} → ${row.to_status}` : `Set to ${row.to_status}`}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {formatDate(row.changed_at)}
                      {row.changed_by_name && ` · ${row.changed_by_name}`}
                      {row.note && ` · ${row.note}`}
                    </p>
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

function AnalysisBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: unknown;
  tone: "moss" | "clay" | "neutral";
}) {
  const isEmpty =
    value == null || (Array.isArray(value) && value.length === 0) || (typeof value === "object" && Object.keys(value as object).length === 0);

  return (
    <div>
      <Badge tone={tone}>{label}</Badge>
      <pre className="mt-2 overflow-auto rounded bg-line-soft/40 p-3 text-xs text-ink-soft">
        {isEmpty ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
