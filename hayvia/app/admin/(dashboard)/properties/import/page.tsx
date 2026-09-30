import AdminCard from "@/components/admin/AdminCard";
import ImportPropertyForm from "@/components/admin/ImportPropertyForm";

export const dynamic = "force-dynamic";

export default function ImportPropertyPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Import Property</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Paste a listing&apos;s full text and AI organizes it into a Draft for you to review — it
        never publishes anything. Add photos and pick Buy/Rent on the normal edit page afterward.
      </p>
      <div className="mt-6 max-w-2xl">
        <AdminCard>
          <ImportPropertyForm />
        </AdminCard>
      </div>
    </div>
  );
}
