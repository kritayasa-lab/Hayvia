import Link from "next/link";
import { Plus, Search } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";
import type { AdminPropertyRow } from "@/lib/admin/properties";

const statusTone: Record<string, "moss" | "clay" | "neutral"> = {
  PUBLISHED: "moss",
  DRAFT: "neutral",
  PENDING_REVIEW: "clay",
  RESERVED: "clay",
  RENTED: "neutral",
  SOLD: "neutral",
  HIDDEN: "neutral",
  ARCHIVED: "neutral",
};

export default function PropertiesTable({
  rows,
  basePath,
  q,
  showTypeColumn = true,
}: {
  rows: AdminPropertyRow[];
  basePath: string;
  q?: string;
  showTypeColumn?: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex items-center gap-2" action={basePath}>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search title, city, or ID..."
              className="w-64 rounded border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/30"
            />
          </div>
          <button
            type="submit"
            className="rounded border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:border-ink/20 hover:text-ink"
          >
            Search
          </button>
        </form>
        <Link
          href="/admin/properties/new"
          className="flex items-center gap-1.5 rounded bg-moss-600 px-4 py-2 text-sm font-medium text-white hover:bg-moss-700"
        >
          <Plus size={15} /> New Property
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-line-soft/60 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              {showTypeColumn && <th className="px-4 py-3 font-medium">Type</th>}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium">Views</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-faint">
                  No properties found.
                </td>
              </tr>
            ) : (
              rows.map((property) => (
                <tr key={property.id} className="hover:bg-line-soft/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/properties/${property.id}`}
                      className="font-medium text-ink hover:text-moss-700 hover:underline"
                    >
                      {property.title}
                    </Link>
                    <p className="text-xs text-ink-faint">{property.property_type}</p>
                  </td>
                  {showTypeColumn && (
                    <td className="px-4 py-3 text-ink-soft">
                      {property.listing_type === "RENT" ? "Rent" : "Sell"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[property.status] ?? "neutral"}>{property.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {formatPrice(property.price)}
                    {property.listing_type === "RENT" && "/mo"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {[property.district, property.city].filter(Boolean).join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {property.featured && <Badge tone="moss">Featured</Badge>}
                      {property.price_reduced && <Badge tone="clay">Reduced</Badge>}
                      {property.verified && <Badge tone="neutral">Verified</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{property.view_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
