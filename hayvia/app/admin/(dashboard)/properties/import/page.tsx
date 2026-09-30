import AdminCard from "@/components/admin/AdminCard";
import ImportPropertyForm from "@/components/admin/ImportPropertyForm";

export const dynamic = "force-dynamic";

export default function ImportPropertyPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Import Property from URL</h1>
      <p className="mt-1 text-sm text-ink-faint">
        AI reads the source and creates a Draft for you to review — it never publishes anything.
        You&apos;ll land on the normal property edit page to check every field before saving.
      </p>
      <div className="mt-6 max-w-2xl">
        <AdminCard>
          <ImportPropertyForm />
        </AdminCard>
      </div>
    </div>
  );
}
