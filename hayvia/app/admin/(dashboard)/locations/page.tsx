import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import LocationForm from "@/components/admin/LocationForm";
import Badge from "@/components/ui/Badge";
import { createLocation, updateLocation, toggleLocationActive } from "@/app/admin/(dashboard)/locations/actions";

export const dynamic = "force-dynamic";

async function fetchLocations() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("locations")
    .select("*")
    .order("province", { ascending: true })
    .order("city", { ascending: true });
  return data ?? [];
}

export default async function AdminLocationsPage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  const locations = await fetchLocations();
  const editing = searchParams.edit ? locations.find((l) => l.id === searchParams.edit) : undefined;

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Locations</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Structured location reference used for dropdowns and SEO location pages. {locations.length} locations.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <AdminCard title={editing ? "Edit Location" : "Add Location"}>
          {editing ? (
            <LocationForm action={updateLocation.bind(null, editing.id)} initial={editing} submitLabel="Save Changes" />
          ) : (
            <LocationForm action={createLocation} submitLabel="Add Location" />
          )}
        </AdminCard>

        <AdminCard title="All Locations">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="py-2 pr-3 font-medium">Location</th>
                  <th className="py-2 pr-3 font-medium">Slug</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-ink-faint">
                      No locations yet.
                    </td>
                  </tr>
                ) : (
                  locations.map((location) => (
                    <tr key={location.id}>
                      <td className="py-2 pr-3 font-medium text-ink">
                        {[location.district, location.city, location.province].filter(Boolean).join(", ")}
                      </td>
                      <td className="py-2 pr-3 text-ink-soft">{location.slug}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={location.is_active ? "moss" : "neutral"}>
                          {location.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-3 text-xs">
                          <a
                            href={`/admin/locations?edit=${location.id}`}
                            className="font-medium text-moss-700 hover:underline"
                          >
                            Edit
                          </a>
                          <form action={toggleLocationActive.bind(null, location.id, !location.is_active)}>
                            <button type="submit" className="font-medium text-ink-faint hover:text-ink">
                              {location.is_active ? "Deactivate" : "Activate"}
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
