import type { Property } from "@/data/properties";
import PropertyCard from "@/components/property/PropertyCard";
import EmptyState from "@/components/ui/EmptyState";

interface PropertyGridProps {
  properties: Property[];
  emptyTitle?: string;
  emptyDescription?: string;
}

export default function PropertyGrid({
  properties,
  emptyTitle = "No properties match those filters",
  emptyDescription = "Try widening your budget range or clearing a filter. You can also tell us what you need directly through Get Matched.",
}: PropertyGridProps) {
  if (properties.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
