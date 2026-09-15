import { fetchAdminProperties } from "@/lib/admin/properties";
import PropertiesTable from "@/components/admin/PropertiesTable";

export const dynamic = "force-dynamic";

export default async function AdminBuyPropertiesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const rows = await fetchAdminProperties({ listingType: "BUY", q: searchParams.q });

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">For Sale</h1>
      <p className="mt-1 text-sm text-ink-faint">{rows.length} propert{rows.length === 1 ? "y" : "ies"} for sale.</p>
      <div className="mt-6">
        <PropertiesTable rows={rows} basePath="/admin/buy" q={searchParams.q} showTypeColumn={false} />
      </div>
    </div>
  );
}
