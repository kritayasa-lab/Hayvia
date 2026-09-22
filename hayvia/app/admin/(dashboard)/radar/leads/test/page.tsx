import AdminCard from "@/components/admin/AdminCard";
import LeadExtractionTestForm from "@/components/admin/LeadExtractionTestForm";

export const dynamic = "force-dynamic";

export default function LeadExtractionTestPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Lead Intelligence — Extraction Test</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Foundation/proof-of-flow tool, not a polished workflow. Paste one raw buyer/renter post to run it
        through AI requirement extraction and the existing matching engine. Each submission creates a real
        Radar Lead candidate (staging data, not a CRM lead) so the extraction is preserved for review.
      </p>
      <div className="mt-6 max-w-3xl">
        <AdminCard>
          <LeadExtractionTestForm />
        </AdminCard>
      </div>
    </div>
  );
}
