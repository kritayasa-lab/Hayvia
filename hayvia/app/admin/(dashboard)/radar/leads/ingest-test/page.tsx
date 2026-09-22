import AdminCard from "@/components/admin/AdminCard";
import LeadIngestionTestForm from "@/components/admin/LeadIngestionTestForm";

export const dynamic = "force-dynamic";

export default function LeadIngestionTestPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Lead Radar — Ingestion Test</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Foundation/proof tool for the ingestion boundary a future Apify Actor will call — no Apify account or
        credentials are used or required here. Submits a mock raw signal straight into{" "}
        <code className="font-mono text-xs">radar_lead_raw</code>, exactly as a real adapter would, without
        running AI extraction. Submit the same source + source identifier twice to see idempotent dedup.
      </p>
      <div className="mt-6 max-w-3xl">
        <AdminCard>
          <LeadIngestionTestForm />
        </AdminCard>
      </div>
    </div>
  );
}
