"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FieldWrapper, TextInput, TextArea, Select } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { RADAR_SOURCE_TYPES } from "@/lib/radar/source-types";
import { runIngestionTest, type IngestionTestState } from "@/app/admin/(dashboard)/radar/leads/ingest-test/actions";

const MOCK_PAYLOAD_PLACEHOLDER = `{
  "text": "หาคอนโดเช่าแถวมอ. งบ 12000 1 ห้องนอน",
  "postedBy": "some-external-user-handle",
  "postedAt": "2026-09-22T10:00:00.000Z"
}`;

export default function LeadIngestionTestForm() {
  const [state, formAction] = useFormState<IngestionTestState | null, FormData>(runIngestionTest, null);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Source type" htmlFor="source_type" required>
            <Select id="source_type" name="source_type" defaultValue="FACEBOOK_GROUP">
              {RADAR_SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Source name" htmlFor="source_name" required hint="e.g. a specific Facebook group's display name.">
            <TextInput id="source_name" name="source_name" defaultValue="Hat Yai Housing Group (mock)" required />
          </FieldWrapper>
          <FieldWrapper label="Source URL" htmlFor="source_url" hint="Optional.">
            <TextInput id="source_url" name="source_url" type="url" placeholder="https://..." />
          </FieldWrapper>
          <FieldWrapper
            label="Source identifier"
            htmlFor="source_identifier"
            hint="Optional — a stable external id (e.g. a post id). Leave blank to test fingerprint-based dedup instead."
          >
            <TextInput id="source_identifier" name="source_identifier" placeholder="e.g. fb-post-123456" />
          </FieldWrapper>
        </div>

        <FieldWrapper
          label="Raw payload (JSON)"
          htmlFor="raw_payload"
          required
          hint="Mimics one Apify Dataset item — stored exactly as given, never interpreted here."
        >
          <TextArea id="raw_payload" name="raw_payload" required className="min-h-[160px] font-mono text-xs" defaultValue={MOCK_PAYLOAD_PLACEHOLDER} />
        </FieldWrapper>

        {state?.error && (
          <p role="alert" className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            {state.error}
          </p>
        )}

        <SubmitButton pendingLabel="Ingesting...">Ingest Mock Signal</SubmitButton>
      </form>

      {state?.result && (
        <div className="space-y-4 border-t border-line-soft pt-6">
          <p className="flex items-start gap-2 rounded border border-moss-100 bg-moss-50 px-3.5 py-2.5 text-sm text-moss-700">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            {state.result.outcome === "created" ? (
              <span>
                New raw signal created (<span className="font-mono text-xs">{state.result.rawId}</span>).
              </span>
            ) : (
              <span>
                Duplicate detected — matched an existing raw signal (<span className="font-mono text-xs">{state.result.rawId}</span>),{" "}
                <code>last_seen_at</code> updated. No new row was created.
              </span>
            )}
          </p>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Outcome</dt>
              <dd>
                <Badge tone={state.result.outcome === "created" ? "moss" : "clay"}>{state.result.outcome}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Source</dt>
              <dd className="text-sm text-ink">
                {state.result.row.sourceType} · {state.result.row.sourceName}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Source URL</dt>
              <dd className="break-all text-sm text-ink">{state.result.row.sourceUrl || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Source identifier</dt>
              <dd className="text-sm text-ink">{state.result.row.sourceIdentifier || "— (fingerprint-based dedup)"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Content fingerprint</dt>
              <dd className="break-all font-mono text-xs text-ink-soft">{state.result.row.contentFingerprint}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Discovered / last seen</dt>
              <dd className="text-sm text-ink">
                {formatDate(state.result.row.discoveredAt)} / {formatDate(state.result.row.lastSeenAt)}
              </dd>
            </div>
          </dl>

          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Stored raw_payload (exactly as submitted)</dt>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-line-soft/40 p-3 text-xs text-ink-soft">
              {JSON.stringify(state.result.row.rawPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
