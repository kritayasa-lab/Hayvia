"use client";

import { useFormState } from "react-dom";
import { AlertCircle } from "lucide-react";
import { FieldWrapper, TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import Badge from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";
import { runLeadExtractionTest, type LeadExtractionTestState } from "@/app/admin/(dashboard)/radar/leads/test/actions";

const intentCategoryTone: Record<string, "moss" | "clay" | "neutral"> = {
  STRONG_INTENT: "moss",
  PROBABLE_INTENT: "moss",
  WEAK_INTENT: "clay",
  NOISE_SPAM: "neutral",
};

const categoryTone: Record<string, "moss" | "clay" | "neutral"> = {
  BUYER: "moss",
  RENTER: "moss",
  SELLER: "clay",
  NOISE: "neutral",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

export default function LeadExtractionTestForm() {
  const [state, formAction] = useFormState<LeadExtractionTestState | null, FormData>(runLeadExtractionTest, null);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <FieldWrapper
          label="Raw post"
          htmlFor="raw_post"
          required
          hint="Paste a raw buyer/renter post exactly as written (Thai or English) — evidence, not a summary."
        >
          <TextArea id="raw_post" name="raw_post" required className="min-h-[160px]" />
        </FieldWrapper>

        {state?.error && (
          <p role="alert" className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            {state.error}
          </p>
        )}

        <SubmitButton pendingLabel="Extracting...">Run Extraction</SubmitButton>
      </form>

      {state?.result && (
        <div className="space-y-6 border-t border-line-soft pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-ink">{state.result.candidateCode}</span>
            <Badge tone={categoryTone[state.result.extraction.category] ?? "neutral"}>{state.result.extraction.category}</Badge>
            <Badge tone={intentCategoryTone[state.result.extraction.intent_category] ?? "neutral"}>
              {state.result.extraction.intent_category.replace(/_/g, " ")}
            </Badge>
            <span className="text-xs text-ink-faint">
              Confidence {state.result.extraction.confidence}% · Lead quality {state.result.extraction.intent_score}%
            </span>
          </div>
          <p className="text-sm text-ink-soft">{state.result.extraction.reason}</p>

          <section>
            <h3 className="font-display text-base text-ink">Extracted requirements</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Category" value={state.result.extraction.category} />
              <Field label="Property type" value={state.result.extraction.property_type} />
              <Field
                label="Location"
                value={
                  [state.result.extraction.location.district, state.result.extraction.location.city, state.result.extraction.location.province]
                    .filter(Boolean)
                    .join(", ") || ""
                }
              />
              <Field
                label="Budget"
                value={
                  state.result.extraction.budget_min != null || state.result.extraction.budget_max != null
                    ? `${state.result.extraction.budget_min != null ? formatPrice(state.result.extraction.budget_min) : "no min"} – ${
                        state.result.extraction.budget_max != null ? formatPrice(state.result.extraction.budget_max) : "no max"
                      }`
                    : ""
                }
              />
              <Field
                label="Bedrooms (min)"
                value={state.result.extraction.bedrooms_min != null ? String(state.result.extraction.bedrooms_min) : ""}
              />
              <Field label="Timeline" value={state.result.extraction.timeline || ""} />
            </dl>
          </section>

          {state.result.extraction.requirements.length > 0 && (
            <section>
              <h3 className="font-display text-base text-ink">Other requirements (evidenced)</h3>
              <ul className="mt-3 space-y-2">
                {state.result.extraction.requirements.map((req, i) => (
                  <li key={i} className="rounded border border-line-soft bg-line-soft/30 px-3 py-2 text-sm">
                    <span className="font-medium text-ink">{req.field}:</span> <span className="text-ink-soft">{req.value}</span>
                    <p className="mt-1 text-xs text-ink-faint">&ldquo;{req.evidence}&rdquo;</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.result.extraction.unknowns.length > 0 && (
            <section>
              <h3 className="font-display text-base text-ink">Unknown / missing</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {state.result.extraction.unknowns.map((u, i) => (
                  <Badge key={i} tone="neutral">
                    {u}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {state.result.limitations.length > 0 && (
            <section>
              <h3 className="font-display text-base text-ink">Matching limitations</h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-faint">
                {state.result.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="font-display text-base text-ink">
              Matched properties
              {state.result.totalCandidatePool > 0 && (
                <span className="ml-2 text-sm font-normal text-ink-faint">
                  (top {state.result.matches.length} of {state.result.totalCandidatePool} candidates)
                </span>
              )}
            </h3>
            {state.result.matches.length === 0 ? (
              <p className="mt-2 text-sm text-ink-faint">
                No matches — either matching could not run (see limitations above) or no candidate property scored
                well enough.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.result.matches.map((m, i) => (
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
                    {m.reasons.length > 0 && (
                      <p className="mt-1 text-xs text-ink-faint">{m.reasons.join(" · ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
