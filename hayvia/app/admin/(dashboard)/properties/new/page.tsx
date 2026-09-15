import { fetchOwners, fetchAgents } from "@/lib/admin/people";
import PropertyForm from "@/components/admin/PropertyForm";
import AdminCard from "@/components/admin/AdminCard";
import { createProperty } from "@/app/admin/(dashboard)/properties/actions";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  const [owners, agents] = await Promise.all([fetchOwners(), fetchAgents()]);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">New Property</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Images and amenities can be added once the property is created.
      </p>
      <div className="mt-6 max-w-3xl">
        <AdminCard>
          <PropertyForm
            action={createProperty}
            owners={owners}
            agents={agents}
            submitLabel="Create Property"
          />
        </AdminCard>
      </div>
    </div>
  );
}
