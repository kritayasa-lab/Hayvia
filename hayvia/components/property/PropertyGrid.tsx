import type { Property } from "@/data/properties";
import PropertyCard from "@/components/property/PropertyCard";
import { SearchX } from "lucide-react";

export default function PropertyGrid({ properties }: { properties: Property[] }) {
  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded border border-dashed border-line py-20 text-center">
        <SearchX className="mb-4 text-ink-faint" size={32} />
        <p className="font-display text-xl text-ink">No properties match those filters</p>
        <p className="mt-2 max-w-sm text-sm text-ink-soft">
          Try widening your budget range or clearing a filter. You can also tell us what
          you need directly through Get Matched.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
