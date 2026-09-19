import { getListingType, type Property } from "@/data/properties";

// -----------------------------------------------------------------------------
// Phase 6 — Matching preview shape. Guests see only these fields before
// clicking "Unlock Property Details"; the full Property object (already
// privacy-safe — sourced exclusively from the public_properties view, see
// lib/properties-source.ts — never the raw `properties` table) is never sent
// in the initial /api/match response. Deliberately omits description, the
// full images[] gallery, googleMapsUrl, and availability fields per the
// Phase 6 product decision. None of these are sensitive on their own — they
// are simply reserved for after unlock, same as the property's own public
// detail page already shows once a customer navigates there.
// -----------------------------------------------------------------------------

export interface PropertyPreview {
  id: string;
  slug: string;
  title: string;
  district: string;
  location: string;
  price: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  size: number;
  listingType: "rent" | "sale";
  image: string | null;
}

export function toPropertyPreview(property: Property): PropertyPreview {
  return {
    id: property.id,
    slug: property.slug,
    title: property.title,
    district: property.district,
    location: property.location,
    price: property.price,
    propertyType: property.propertyType,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    size: property.size,
    listingType: getListingType(property),
    image: property.images[0] ?? null,
  };
}
