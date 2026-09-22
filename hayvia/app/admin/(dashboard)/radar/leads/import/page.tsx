import AdminCard from "@/components/admin/AdminCard";
import ApifyLeadImportPanel from "@/components/admin/ApifyLeadImportPanel";

export const dynamic = "force-dynamic";

export default function LeadImportPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Lead Radar — Import Apify Dataset</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Two explicit steps: import a Dataset export (no AI, just ingestion + dedup), then classify what&apos;s
        pending (AI runs once per item). No live Apify account/token is used — paste a Dataset JSON array
        exported from a real Apify run.
      </p>
      <div className="mt-6 max-w-3xl">
        <AdminCard>
          <ApifyLeadImportPanel />
        </AdminCard>
      </div>
    </div>
  );
}
