"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FieldWrapper, TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import Badge from "@/components/ui/Badge";
import {
  importApifyDataset,
  classifyPendingLeads,
  type ImportDatasetState,
  type ClassifyPendingState,
} from "@/app/admin/(dashboard)/radar/leads/import/actions";

const DATASET_PLACEHOLDER = `[
  {
    "post_url": "https://www.facebook.com/groups/123456789/posts/987654321",
    "text": "ตามหาบ้านในหาดใหญ่ ขอราคาไม่เกิน 2.5 ล้านบาทค่ะ",
    "author_name": "Somchai P.",
    "author_id": "100012345678901",
    "date": "2026-09-10T08:30:00.000Z",
    "reaction_count": 3,
    "comment_count": 1,
    "share_count": 0,
    "group_name": "หาดใหญ่ บ้านมือสอง ซื้อ-ขาย-เช่า",
    "group_url": "https://www.facebook.com/groups/123456789",
    "group_id": "123456789",
    "processed_at": "2026-09-22T02:00:00.000Z"
  }
]`;

const categoryTone: Record<string, "moss" | "clay" | "neutral"> = {
  BUYER: "moss",
  RENTER: "moss",
  SELLER: "clay",
  NOISE: "neutral",
};

function ImportForm() {
  const [state, formAction] = useFormState<ImportDatasetState | null, FormData>(importApifyDataset, null);

  return (
    <form action={formAction} className="space-y-4">
      <FieldWrapper
        label="Apify Dataset JSON"
        htmlFor="dataset_json"
        required
        hint="Paste the Dataset export (a JSON array of items) from an Apify run, e.g. lofomachines/facebook-groups-posts-search-scraper. No live Apify connection is used — this is a manual paste."
      >
        <TextArea id="dataset_json" name="dataset_json" required className="min-h-[220px] font-mono text-xs" defaultValue={DATASET_PLACEHOLDER} />
      </FieldWrapper>

      {state?.error && (
        <p role="alert" className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel="Importing...">Import Dataset</SubmitButton>

      {state?.summary && (
        <div className="space-y-3 border-t border-line-soft pt-4">
          <p className="flex items-start gap-2 rounded border border-moss-100 bg-moss-50 px-3.5 py-2.5 text-sm text-moss-700">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            {state.summary.total} item{state.summary.total === 1 ? "" : "s"} processed: {state.summary.created} created,{" "}
            {state.summary.deduped} deduped (already seen), {state.summary.rejected} rejected.
          </p>
          {state.summary.rejectedDetails.length > 0 && (
            <ul className="space-y-1 text-xs text-red-600">
              {state.summary.rejectedDetails.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

function ClassifyForm() {
  const [state, formAction] = useFormState<ClassifyPendingState | null, FormData>(classifyPendingLeads, null);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-ink-faint">
        Runs AI classification on every imported raw signal that hasn&apos;t been classified yet — creates a candidate,
        classifies it as BUYER / RENTER / SELLER / NOISE, extracts requirements, and (for BUYER/RENTER) runs the
        existing matching engine. Each pending item is one AI call.
      </p>

      <SubmitButton pendingLabel="Classifying...">Classify Pending</SubmitButton>

      {state?.error && (
        <p role="alert" className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          {state.error}
        </p>
      )}

      {state?.summary && (
        <div className="space-y-3 border-t border-line-soft pt-4">
          <p className="flex items-start gap-2 rounded border border-moss-100 bg-moss-50 px-3.5 py-2.5 text-sm text-moss-700">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            {state.summary.processed} item{state.summary.processed === 1 ? "" : "s"} processed, {state.summary.matched} had
            at least one property match, {state.summary.failed} failed.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(state.summary.byCategory).map(([category, count]) => (
              <Badge key={category} tone={categoryTone[category] ?? "neutral"}>
                {category}: {count}
              </Badge>
            ))}
          </div>
          {state.summary.failedDetails.length > 0 && (
            <ul className="space-y-1 text-xs text-red-600">
              {state.summary.failedDetails.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

export default function ApifyLeadImportPanel() {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-display text-base text-ink">1. Import Dataset</h3>
        <p className="mt-1 text-sm text-ink-faint">
          Ingestion only — no AI, no classification. Dedupes on post_url via the existing ingestion boundary.
        </p>
        <div className="mt-3">
          <ImportForm />
        </div>
      </section>

      <section className="border-t border-line-soft pt-8">
        <h3 className="font-display text-base text-ink">2. Classify Pending</h3>
        <ClassifyForm />
      </section>
    </div>
  );
}
