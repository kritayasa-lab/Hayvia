import { fetchOwners } from "@/lib/admin/people";
import AdminCard from "@/components/admin/AdminCard";
import OwnerForm from "@/components/admin/OwnerForm";
import Badge from "@/components/ui/Badge";
import { createOwner, updateOwner, toggleOwnerStatus } from "@/app/admin/(dashboard)/owners/actions";

export const dynamic = "force-dynamic";

export default async function AdminOwnersPage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  const owners = await fetchOwners();
  const editing = searchParams.edit ? owners.find((o) => o.id === searchParams.edit) : undefined;

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Owners</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Private — property owner contact details. Never shown on the public website. {owners.length} owners.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <AdminCard title={editing ? `Edit ${editing.name}` : "Add Owner"}>
          {editing ? (
            <OwnerForm action={updateOwner.bind(null, editing.id)} initial={editing} submitLabel="Save Changes" />
          ) : (
            <OwnerForm action={createOwner} submitLabel="Add Owner" />
          )}
        </AdminCard>

        <AdminCard title="All Owners">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Contact</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {owners.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-ink-faint">
                      No owners yet.
                    </td>
                  </tr>
                ) : (
                  owners.map((owner) => (
                    <tr key={owner.id}>
                      <td className="py-2 pr-3 font-medium text-ink">{owner.name}</td>
                      <td className="py-2 pr-3 text-ink-soft">
                        {[owner.phone, owner.email].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge tone={owner.status === "ACTIVE" ? "moss" : "neutral"}>{owner.status}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-3 text-xs">
                          <a href={`/admin/owners?edit=${owner.id}`} className="font-medium text-moss-700 hover:underline">
                            Edit
                          </a>
                          <form
                            action={toggleOwnerStatus.bind(
                              null,
                              owner.id,
                              owner.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                            )}
                          >
                            <button type="submit" className="font-medium text-ink-faint hover:text-ink">
                              {owner.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
