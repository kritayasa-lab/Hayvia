import { fetchAdminProperties } from "@/lib/admin/properties";
import PropertiesTable from "@/components/admin/PropertiesTable";

export const dynamic = "force-dynamic";

// Thin wrapper around the same Properties list, pre-filtered to Rent — the
// brief asks for /admin/rent and /admin/buy as their own nav entries rather
// than a toggle on one page, so this reuses fetchAdminProperties/
// PropertiesTable instead of duplicating query or table logic.
export default async function AdminRentPropertiesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const rows = await fetchAdminProperties({ listingType: "RENT", q: searchParams.q });

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">For Rent</h1>
      <p className="mt-1 text-sm text-ink-faint">{rows.length} rental propert{rows.length === 1 ? "y" : "ies"}.</p>
      <div className="mt-6">
        <PropertiesTable rows={rows} basePath="/admin/rent" q={searchParams.q} showTypeColumn={false} />
      </div>
    </div>
  );
}
