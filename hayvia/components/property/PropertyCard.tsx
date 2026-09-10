import Image from "next/image";
import Link from "next/link";
import { BedDouble, Bath, Ruler, Car, ShieldCheck } from "lucide-react";
import type { Property } from "@/data/properties";
import { formatPrice, formatDate } from "@/lib/utils";
import Badge from "@/components/ui/Badge";

export default function PropertyCard({ property }: { property: Property }) {
  const bedroomLabel = property.bedrooms === 0 ? "Studio" : `${property.bedrooms} bed`;

  return (
    <Link
      href={`/properties/${property.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded border border-line bg-surface shadow-card transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-line-soft">
        <Image
          src={property.images[0]}
          alt={property.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          {property.verified && (
            <Badge tone="moss" className="bg-surface/95">
              <ShieldCheck size={12} /> Verified Listing
            </Badge>
          )}
          {property.status === "reserved" && (
            <Badge tone="neutral" className="bg-surface/95">
              Reserved
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-snug text-ink">{property.title}</h3>
        </div>
        <p className="mt-1 text-sm text-ink-soft">{property.location}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble size={15} /> {bedroomLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bath size={15} /> {property.bathrooms} bath
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Ruler size={15} /> {property.size} sqm
          </span>
          {property.parking && (
            <span className="inline-flex items-center gap-1.5">
              <Car size={15} /> Parking
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-ink-faint">
          <span>{property.propertyType}</span>
          <span aria-hidden>·</span>
          <span>{property.furnished}</span>
        </div>

        <div className="mt-auto flex items-end justify-between pt-5">
          <div>
            <p className="font-display text-xl text-ink">{formatPrice(property.price)}</p>
            <p className="text-xs text-ink-faint">per month</p>
          </div>
          <span className="text-sm font-medium text-moss-700 group-hover:underline">
            View Property
          </span>
        </div>

        <p className="mt-2 text-xs text-ink-faint">
          Available from {formatDate(property.availableDate)}
        </p>
      </div>
    </Link>
  );
}
