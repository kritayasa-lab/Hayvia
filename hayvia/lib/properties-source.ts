import type { Property, PropertyType, FurnishedStatus, District, ContactType } from "@/data/properties";
import { GOOGLE_APPS_SCRIPT_URL } from "@/config/integrations";

type SheetProperty = Record<string, unknown>;

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toNumberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toBooleanValue(value: unknown): boolean {
  return String(value).toLowerCase() === "yes" || value === true;
}

function parseAmenities(value: unknown): string[] {
  return toStringValue(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseImages(row: SheetProperty): string[] {
  const imageKeys = [
    "Image 1",
    "Image 2",
    "Image 3",
    "Image 4",
    "Image 5",
    "Image 6",
    "Image 7",
    "Image 8",
  ];

  const images = imageKeys
    .map((key) => toStringValue(row[key]))
    .filter(Boolean);

  return images.length > 0 ? images : ["/images/hero-living-room.jpg"];
}

function normalizeStatus(value: unknown): Property["status"] {
  return String(value).toLowerCase() === "reserved" ? "reserved" : "available";
}

function normalizePropertyType(value: unknown): PropertyType {
  const type = toStringValue(value);

  if (
    type === "Condo" ||
    type === "Apartment" ||
    type === "House" ||
    type === "Townhouse"
  ) {
    return type;
  }

  return "Apartment";
}

function normalizeFurnished(value: unknown): FurnishedStatus {
  const furnished = toStringValue(value);

  if (
    furnished === "Fully furnished" ||
    furnished === "Partially furnished" ||
    furnished === "Unfurnished"
  ) {
    return furnished;
  }

  return "Unfurnished";
}

function normalizeDistrict(value: unknown): District {
  const district = toStringValue(value);

  if (
    district === "Central Hat Yai" ||
    district === "Kho Hong" ||
    district === "PSU / University Area" ||
    district === "Khlong Hae"
  ) {
    return district;
  }

  return "Central Hat Yai";
}

function normalizeContactType(value: unknown): ContactType {
  const contact = toStringValue(value);

  if (contact === "LINE" || contact === "Email") {
    return contact;
  }

  return "WhatsApp";
}

function mapSheetRowToProperty(row: SheetProperty): Property {
  return {
    id: toStringValue(row["ID"]),
    slug: toStringValue(row["Slug"]),
    title: toStringValue(row["Title"]),
    location:
      toStringValue(row["Location"]) ||
      toStringValue(row["Area"]),
    district: normalizeDistrict(row["Area"]),
    price: toNumberValue(row["Monthly Rent"]),
    propertyType: normalizePropertyType(row["Property Type"]),
    bedrooms: toNumberValue(row["Bedrooms"]),
    bathrooms: toNumberValue(row["Bathrooms"]),
    size: toNumberValue(row["Size (sqm)"]),
    furnished: normalizeFurnished(row["Furnished"]),
    parking: toBooleanValue(row["Parking"]),
    wifi: toBooleanValue(row["WiFi"]),
    availableDate: toStringValue(row["Available Date"]),
    minimumLease: toStringValue(row["Minimum Rental"]),
    deposit: toStringValue(row["Deposit"]),
    description: toStringValue(row["Description"]),
    amenities: parseAmenities(row["Amenities"]),
    images: parseImages(row),
    verified: toBooleanValue(row["Verified"]),
    featured: toBooleanValue(row["Featured"]),
    status: normalizeStatus(row["Status"]),
    contactType: normalizeContactType(row["Contact Type"]),
  };
}

export async function getProperties(): Promise<Property[]> {
  const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Google Sheets request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!data?.success || !Array.isArray(data.properties)) {
    throw new Error("Google Sheets returned an invalid properties response");
  }

  return data.properties
    .filter((row: SheetProperty) => {
      const status = toStringValue(row["Status"]).toLowerCase();
      return status !== "hidden";
    })
    .map(mapSheetRowToProperty);
}

export async function getPropertyBySlug(
  slug: string
): Promise<Property | undefined> {
  const properties = await getProperties();
  return properties.find((property) => property.slug === slug);
}

export async function getFeaturedProperties(
  limit = 6
): Promise<Property[]> {
  const properties = await getProperties();

  return properties
    .filter((property) => property.featured)
    .slice(0, limit);
}

export async function getRelatedProperties(
  current: Property,
  limit = 3
): Promise<Property[]> {
  const properties = await getProperties();

  return properties
    .filter(
      (property) =>
        property.id !== current.id &&
        property.district === current.district
    )
    .slice(0, limit)
    .concat(
      properties.filter(
        (property) =>
          property.id !== current.id &&
          property.district !== current.district
      )
    )
    .slice(0, limit);
}
