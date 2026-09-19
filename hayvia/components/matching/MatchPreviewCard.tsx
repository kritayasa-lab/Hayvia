import Image from "next/image";
import Link from "next/link";
import { BedDouble, Bath, Ruler, Lock } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { PropertyPreview } from "@/lib/matching/preview";

// -----------------------------------------------------------------------------
// Phase 6 — the guest-facing preview card for a matching result, before
// "Unlock Property Details". Deliberately a separate component from
// components/property/PropertyCard.tsx (which expects the FULL Property
// object and links straight to /properties/[slug]) rather than a variant of
// it — this card only ever receives the trimmed PropertyPreview shape
// (lib/matching/preview.ts) and never links anywhere until `unlocked`.
// -----------------------------------------------------------------------------

export default function MatchPreviewCard({
  property,
  unlocked,
}: {
  property: PropertyPreview;
  unlocked: boolean;
}) {
  const bedroomLabel = property.bedrooms === 0 ? "Studio" : `${property.bedrooms} bed`;
  const forSale = property.listingType === "sale";

  const card = (
    <div className="flex h-full flex-col overflow-hidden rounded border border-seashell bg-white shadow-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-line-soft">
        {property.image ? (
          <Image
            src={property.image}
            alt={property.title}
            fill
            sizes="(max-width: 768px) 100vw, 280px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-faint">No photo</div>
        )}
        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/10 backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-ink shadow">
              <Lock size={12} /> Preview
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg leading-snug text-ink">{property.title}</h3>
        <p className="mt-1 text-sm text-ink-soft">{property.district}</p>

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
        </div>

        <div className="mt-auto pt-5">
          <p className="font-display text-xl text-ink">{formatPrice(property.price)}</p>
          <p className="text-xs text-ink-faint">{forSale ? "asking price" : "per month"}</p>
        </div>

        {unlocked && (
          <Link
            href={`/properties/${property.slug}`}
            className="mt-4 inline-flex items-center justify-center rounded border border-line px-4 py-2 text-sm font-medium text-moss-700 transition-colors hover:border-moss-500"
          >
            View Full Details
          </Link>
        )}
      </div>
    </div>
  );

  return card;
}
