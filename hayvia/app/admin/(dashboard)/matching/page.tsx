import { fetchMatchingRuns } from "@/lib/admin/crm";
import { formatDate, formatPriceRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminMatchingPage() {
  const runs = await fetchMatchingRuns();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Matching Requests</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Every Get Matched quiz run and the top property matches it produced. {runs.length} recent requests.
      </p>

      <div className="mt-6 space-y-3">
        {runs.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface p-8 text-center text-ink-faint">
            No matching requests yet.
          </div>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="rounded-lg border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    {run.purpose === "BUY" ? "Buy" : "Rent"} · {run.property_type || "Any type"}
                    {run.bedrooms !== null && ` · ${run.bedrooms} bed`}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {[run.district, run.city, run.province].filter(Boolean).join(", ") || "No location preference"}
                  </p>
                  {(run.budget_min || run.budget_max) && (
                    <p className="text-sm text-ink-soft">
                      Budget: {formatPriceRange(run.budget_min ?? 0, run.budget_max ?? undefined)}
                    </p>
                  )}
                </div>
                <p className="text-xs text-ink-faint">{formatDate(run.created_at)}</p>
              </div>

              <div className="mt-3 border-t border-line-soft pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Top Matches</p>
                {run.topMatches.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-faint">No matches were found for this request.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {run.topMatches.map((match, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-ink-soft">{match.propertyTitle}</span>
                        <span className="font-medium text-moss-700">{match.score}% match</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
