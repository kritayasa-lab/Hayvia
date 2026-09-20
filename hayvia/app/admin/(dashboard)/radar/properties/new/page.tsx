import AdminCard from "@/components/admin/AdminCard";
import RadarPropertyIntakeForm from "@/components/admin/RadarPropertyIntakeForm";

export const dynamic = "force-dynamic";

export default function NewRadarPropertyCandidatePage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Add Property Candidate</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Manual entry only — record a potential property Subphiphat may want to acquire/list. This is
        staging data, not a real property, until it&apos;s reviewed and explicitly approved.
      </p>
      <div className="mt-6 max-w-3xl">
        <AdminCard>
          <RadarPropertyIntakeForm />
        </AdminCard>
      </div>
    </div>
  );
}
