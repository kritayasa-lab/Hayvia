import { notFound } from "next/navigation";
import Link from "next/link";
import AdminCard from "@/components/admin/AdminCard";
import Badge from "@/components/ui/Badge";
import { formatDate, formatPrice } from "@/lib/utils";
import { fetchRadarLeadCandidateDetail } from "@/lib/admin/radar-leads";
import { matchLeadFacts } from "@/lib/radar/lead-intelligence";
import { createAdminClient } from "@/lib/supabase/admin";
import { runLeadIntelligenceAction } from "@/app/admin/(dashboard)/radar/leads/[id]/actions";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// PR #25 — Lead Radar candidate detail. Deliberately MVP-scoped per this
// PR's own instruction: raw evidence, AI classification, extracted
// requirements, matched properties, a link to the original post, and a
// "Run Lead Intelligence" action. NO CRM notes, contact history, follow-up
// workflow, or outreach UI of any kind — those are explicitly out of scope
// here, not a deferred TODO.
//
// This shows the AI classification/requirements UI for Lead Radar
// specifically — a distinct, currently-desired feature, not a revival of
// the Property AI feature PR #22 removed (that removal was about the old
// Claude-based Property Radar analysis flow; this is new, requested code
// for a different domain).
// -----------------------------------------------------------------------------

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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

export default async function RadarLeadCandidateDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { classified?: string; classifyError?: string };
}) {
  const detail = await fetchRadarLeadCandidateDetail(params.id);
  if (!detail) notFound();

  const { candidate, source, raw, analyses, history } = detail;
  const latest = analyses[0] ?? null;
  const rawPayload = (raw?.raw_payload ?? null) as Record<string, unknown> | null;
  const postUrl = (candidate.source_url as string | null) ?? (rawPayload?.post_url as string | undefined) ?? null;

  const supabase = createAdminClient();
  const { matches, limitations, totalCandidatePool } = await matchLeadFacts(supabase, {
    purpose: candidate.purpose === "BUY" || candidate.purpose === "RENT" ? (candidate.purpose as "BUY" | "RENT") : null,
    propertyType: (candidate.property_type as string | null) ?? null,
    city: candidate.city as string | null,
    district: candidate.district as string | null,
    budgetMin: candidate.budget_min as number | null,
    budgetMax: candidate.budget_max as number | null,
    bedroomsMin: candidate.bedrooms as number | null,
  });

  return (
    <div>
      <Link href="/admin/radar/leads" className="text-xs font-medium text-ink-faint hover:text-ink">
        &larr; Back to Lead Radar
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl text-ink">{candidate.candidate_code as string}</h1>
            <Badge tone="neutral">{(candidate.status as string).replace(/_/g, " ")}</Badge>
            {candidate.lead_category ? (
              <Badge tone={categoryTone[candidate.lead_category as string] ?? "neutral"}>{candidate.lead_category as string}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-faint">
            Discovered {formatDate(candidate.discovered_at as string)} · Last seen {formatDate(candidate.last_seen_at as string)}
          </p>
        </div>

        <form action={runLeadIntelligenceAction.bind(null, candidate.id as string)}>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded bg-moss-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {latest ? "Re-run Lead Intelligence" : "Run Lead Intelligence"}
          </button>
        </form>
      </div>

      {searchParams.classified === "1" && (
        <p className="mt-4 rounded border border-moss-100 bg-moss-50 px-3.5 py-2.5 text-sm text-moss-700">
          Classification complete.
        </p>
      )}
      {searchParams.classifyError && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
          {decodeURIComponent(searchParams.classifyError)}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <AdminCard title="Source">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Source</dt>
                <dd className="text-ink">
                  {source?.source_type || "—"} {source?.name ? `· ${source.name}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Original post</dt>
                <dd className="break-all text-ink">
                  {postUrl ? (
                    <a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-moss-700 hover:underline">
                      {postUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Raw Evidence" description="Admin-only. Preserved exactly as ingested.">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-moss-700">Show raw evidence</summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded bg-line-soft/40 p-3 text-xs text-ink-soft">
                {raw ? JSON.stringify(rawPayload, null, 2) : "No raw record linked."}
              </pre>
            </details>
          </AdminCard>

          <AdminCard title="Extracted Requirements">
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Category" value={(candidate.lead_category as string) || "Not classified"} />
              <Field label="Property type" value={(candidate.property_type as string) || ""} />
              <Field
                label="Location"
                value={[candidate.district, candidate.city, candidate.province].filter(Boolean).join(", ") as string}
              />
              <Field
                label="Budget"
                value={
                  candidate.budget_min != null || candidate.budget_max != null
                    ? `${candidate.budget_min != null ? formatPrice(candidate.budget_min as number) : "no min"} – ${
                        candidate.budget_max != null ? formatPrice(candidate.budget_max as number) : "no max"
                      }`
                    : ""
                }
              />
              <Field label="Bedrooms (min)" value={candidate.bedrooms != null ? String(candidate.bedrooms) : ""} />
              <Field label="Timeline" value={(candidate.timeline as string) || ""} />
            </dl>

            {latest && (latest.ai_inference.requirements as unknown[] | undefined)?.length ? (
              <div className="mt-4">
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Other requirements (evidenced)</dt>
                <ul className="mt-2 space-y-2">
                  {(latest.ai_inference.requirements as Array<{ field: string; value: string; evidence: string }>).map((req, i) => (
                    <li key={i} className="rounded border border-line-soft bg-line-soft/30 px-3 py-2 text-sm">
                      <span className="font-medium text-ink">{req.field}:</span> <span className="text-ink-soft">{req.value}</span>
                      <p className="mt-1 text-xs text-ink-faint">&ldquo;{req.evidence}&rdquo;</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {latest && latest.unknowns.length > 0 ? (
              <div className="mt-4">
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Unknown / missing</dt>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(latest.unknowns as string[]).map((u, i) => (
                    <Badge key={i} tone="neutral">
                      {u}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </AdminCard>
        </div>

        <div className="space-y-6">
          <AdminCard
            title="AI Classification"
            description={latest ? `Version ${latest.version} · ${formatDate(latest.created_at)}` : "Not classified yet"}
          >
            {latest ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={leadQualityTone[latest.intent_category ?? ""] ?? "neutral"}>
                    {latest.intent_category?.replace(/_/g, " ") || "—"}
                  </Badge>
                  <span className="text-xs text-ink-faint">
                    Confidence {latest.confidence}% · Lead quality score {latest.intent_score}%
                  </span>
                </div>
                <p className="text-sm text-ink-soft">{(latest.ai_inference.reason as string) || "—"}</p>
                {latest.model_name && <p className="text-xs text-ink-faint">Model: {latest.model_name}</p>}
              </div>
            ) : (
              <p className="text-sm text-ink-faint">
                No classification has been run yet. Click &ldquo;Run Lead Intelligence&rdquo; above.
              </p>
            )}
          </AdminCard>

          <AdminCard
            title="Matched Properties"
            description={totalCandidatePool > 0 ? `Top ${matches.length} of ${totalCandidatePool} candidates` : undefined}
          >
            {limitations.length > 0 && (
              <ul className="mb-3 space-y-1 text-xs text-ink-faint">
                {limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {matches.length === 0 ? (
              <p className="text-sm text-ink-faint">
                No matches — either this candidate isn&apos;t a BUYER/RENTER, matching hasn&apos;t run yet, or no
                property scored well enough.
              </p>
            ) : (
              <ul className="space-y-2">
                {matches.map((m, i) => (
                  <li key={i} className="rounded border border-line-soft px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-mono text-xs text-ink-faint">{m.propertyCode || "—"}</span>{" "}
                        <span className="font-medium text-ink">{m.title}</span>
                      </div>
                      <Badge tone="moss">{m.overall}% match</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatPrice(m.price)} · {m.location}
                    </p>
                    {m.reasons.length > 0 && <p className="mt-1 text-xs text-ink-faint">{m.reasons.join(" · ")}</p>}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Status History">
            {history.length === 0 ? (
              <p className="text-sm text-ink-faint">No status changes recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((row) => (
                  <li key={row.id} className="text-sm">
                    <p className="text-ink">{row.from_status ? `${row.from_status} → ${row.to_status}` : `Set to ${row.to_status}`}</p>
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
