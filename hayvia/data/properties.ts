// -----------------------------------------------------------------------------
// Property data
// -----------------------------------------------------------------------------
// This is the single source of truth for every property shown on Subphiphat Real Estate.
// The homepage, /properties listing, filters, and /properties/[slug] detail
// pages all render from this file — nothing is hard-coded elsewhere.
//
// SAMPLE DATA NOTICE:
// Every listing below is illustrative demo data for the MVP. Locations,
// prices and descriptions are realistic for Hat Yai but do not represent
// real, currently available properties or real addresses.
//
// To add a real property, append a new object to `properties` with a unique
// `id` and `slug`. Everything else in the app updates automatically.
// -----------------------------------------------------------------------------

export type PropertyType = "Condo" | "Apartment" | "House" | "Townhouse";
export type FurnishedStatus = "Fully furnished" | "Partially furnished" | "Unfurnished";
export type District =
  | "Central Hat Yai"
  | "Kho Hong"
  | "PSU / University Area"
  | "Khlong Hae";
export type ContactType = "WhatsApp" | "LINE" | "Email";

export interface Property {
  id: string;
  slug: string;
  title: string;
  location: string;
  district: District;
  price: number;
  propertyType: PropertyType;
  bedrooms: number; // 0 = studio
  bathrooms: number;
  size: number; // sqm
  furnished: FurnishedStatus;
  parking: boolean;
  wifi: boolean;
  availableDate: string; // ISO date
  minimumLease: string;
  deposit: string;
  description: string;
  amenities: string[];
  images: string[];
  verified: boolean;
  featured: boolean;
  // "rented" added for Google Sheets compatibility (see lib/properties-source.ts).
  // None of the hardcoded demo properties below use it — they're unaffected.
  status: "available" | "reserved" | "rented";
  contactType: ContactType;
  // Optional fields below are populated when a property comes from Google
  // Sheets (see lib/properties-source.ts). They're optional specifically so
  // none of the hardcoded demo properties below need to be touched.
  googleMapsUrl?: string;
  viewCount?: number;
}

export const properties: Property[] = [
  {
    id: "p1",
    slug: "riverline-residence-1br-central",
    title: "Riverline Residence — 1 Bedroom",
    location: "Thanon Niphat Uthit 3, Central Hat Yai",
    district: "Central Hat Yai",
    price: 12000,
    propertyType: "Condo",
    bedrooms: 1,
    bathrooms: 1,
    size: 34,
    furnished: "Fully furnished",
    parking: true,
    wifi: true,
    availableDate: "2026-10-01",
    minimumLease: "6 months",
    deposit: "2 months rent + 1 month advance",
    description:
      "A compact, well-kept condo unit a short walk from Lee Gardens Plaza and the Central Hat Yai night market. Good fit for a single tenant or couple who wants to be close to shopping, restaurants and transport links without paying for extra space.",
    amenities: ["Swimming pool", "Fitness room", "24-hour security", "Elevator", "CCTV"],
    images: [
      "https://picsum.photos/seed/subphiphat-p1-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p1-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p1-c/1200/800",
    ],
    verified: true,
    featured: true,
    status: "available",
    contactType: "WhatsApp",
  },
  {
    id: "p2",
    slug: "kho-hong-garden-townhouse",
    title: "Kho Hong Garden Townhouse",
    location: "Kho Hong, Hat Yai",
    district: "Kho Hong",
    price: 15500,
    propertyType: "Townhouse",
    bedrooms: 2,
    bathrooms: 2,
    size: 90,
    furnished: "Partially furnished",
    parking: true,
    wifi: false,
    availableDate: "2026-09-20",
    minimumLease: "12 months",
    deposit: "2 months rent",
    description:
      "A quiet two-storey townhouse in a residential Kho Hong sub-project, suited to a small family or a couple who wants more space and a small front yard while staying a short drive from central Hat Yai.",
    amenities: ["Private parking", "Small garden", "Village security gate", "Air conditioning (2 units)"],
    images: [
      "https://picsum.photos/seed/subphiphat-p2-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p2-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p2-c/1200/800",
    ],
    verified: true,
    featured: true,
    status: "available",
    contactType: "LINE",
  },
  {
    id: "p3",
    slug: "psu-view-studio",
    title: "PSU View Studio",
    location: "Near Prince of Songkla University, PSU Area",
    district: "PSU / University Area",
    price: 6500,
    propertyType: "Apartment",
    bedrooms: 0,
    bathrooms: 1,
    size: 22,
    furnished: "Fully furnished",
    parking: false,
    wifi: true,
    availableDate: "2026-09-15",
    minimumLease: "1 month",
    deposit: "1 month rent + 1 month advance",
    description:
      "A budget-friendly studio in a low-rise apartment block popular with students and young professionals. Walking distance to PSU's main gate, tutoring centres and inexpensive local eateries.",
    amenities: ["Communal laundry", "Bike parking", "On-site convenience store", "CCTV"],
    images: [
      "https://picsum.photos/seed/subphiphat-p3-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p3-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p3-c/1200/800",
    ],
    verified: false,
    featured: true,
    status: "available",
    contactType: "WhatsApp",
  },
  {
    id: "p4",
    slug: "khlong-hae-family-house",
    title: "Khlong Hae Family House",
    location: "Khlong Hae, Hat Yai",
    district: "Khlong Hae",
    price: 22000,
    propertyType: "House",
    bedrooms: 3,
    bathrooms: 2,
    size: 140,
    furnished: "Unfurnished",
    parking: true,
    wifi: false,
    availableDate: "2026-11-01",
    minimumLease: "12 months",
    deposit: "2 months rent + 1 month advance",
    description:
      "A detached single-storey house in a peaceful Khlong Hae neighbourhood, close to the floating market and weekend food stalls. Suited to a family that wants a garden, extra bedrooms and a slower pace outside the city centre.",
    amenities: ["Private garden", "Carport (2 cars)", "Storage room", "Village entrance gate"],
    images: [
      "https://picsum.photos/seed/subphiphat-p4-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p4-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p4-c/1200/800",
    ],
    verified: true,
    featured: true,
    status: "available",
    contactType: "Email",
  },
  {
    id: "p5",
    slug: "lee-gardens-view-2br",
    title: "Lee Gardens View — 2 Bedroom",
    location: "Thanon Sanehanusorn, Central Hat Yai",
    district: "Central Hat Yai",
    price: 19500,
    propertyType: "Condo",
    bedrooms: 2,
    bathrooms: 2,
    size: 58,
    furnished: "Fully furnished",
    parking: true,
    wifi: true,
    availableDate: "2026-10-10",
    minimumLease: "6 months",
    deposit: "2 months rent + 1 month advance",
    description:
      "A higher-floor two-bedroom unit with city views, in a well-maintained condo building near Lee Gardens Plaza. A comfortable option for a small family, roommates, or a professional who works from home and wants an extra room.",
    amenities: ["Swimming pool", "Fitness room", "Co-working lounge", "24-hour security", "Elevator"],
    images: [
      "https://picsum.photos/seed/subphiphat-p5-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p5-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p5-c/1200/800",
    ],
    verified: true,
    featured: false,
    status: "available",
    contactType: "WhatsApp",
  },
  {
    id: "p6",
    slug: "kho-hong-modern-condo",
    title: "Kho Hong Modern Condo",
    location: "Kho Hong, Hat Yai",
    district: "Kho Hong",
    price: 9800,
    propertyType: "Condo",
    bedrooms: 1,
    bathrooms: 1,
    size: 30,
    furnished: "Fully furnished",
    parking: true,
    wifi: true,
    availableDate: "2026-09-25",
    minimumLease: "3 months",
    deposit: "1 month rent + 1 month advance",
    description:
      "A recently built condo unit in Kho Hong with straightforward, modern interiors. A practical mid-range option for a tenant who wants furnished convenience without paying central Hat Yai prices.",
    amenities: ["Swimming pool", "Fitness room", "CCTV", "Keycard access"],
    images: [
      "https://picsum.photos/seed/subphiphat-p6-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p6-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p6-c/1200/800",
    ],
    verified: false,
    featured: false,
    status: "available",
    contactType: "LINE",
  },
  {
    id: "p7",
    slug: "psu-corner-1br-apartment",
    title: "PSU Corner 1BR Apartment",
    location: "Near PSU Gate 2, PSU Area",
    district: "PSU / University Area",
    price: 8500,
    propertyType: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    size: 28,
    furnished: "Partially furnished",
    parking: true,
    wifi: false,
    availableDate: "2026-09-18",
    minimumLease: "3 months",
    deposit: "1 month rent + 1 month advance",
    description:
      "A corner unit with extra window light, in a small apartment building popular with graduate students and university staff. Basic furniture is included; tenants typically add their own kitchen appliances.",
    amenities: ["Motorbike parking", "Communal laundry", "On-site management"],
    images: [
      "https://picsum.photos/seed/subphiphat-p7-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p7-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p7-c/1200/800",
    ],
    verified: true,
    featured: false,
    status: "available",
    contactType: "WhatsApp",
  },
  {
    id: "p8",
    slug: "khlong-hae-riverside-townhouse",
    title: "Khlong Hae Riverside Townhouse",
    location: "Khlong Hae, Hat Yai",
    district: "Khlong Hae",
    price: 17000,
    propertyType: "Townhouse",
    bedrooms: 2,
    bathrooms: 2,
    size: 80,
    furnished: "Partially furnished",
    parking: true,
    wifi: false,
    availableDate: "2026-10-05",
    minimumLease: "6 months",
    deposit: "2 months rent",
    description:
      "A two-bedroom townhouse a few minutes' walk from Khlong Hae's canal-side market street. Reasonably priced for the space, with a small covered parking area at the front.",
    amenities: ["Private parking", "Air conditioning (2 units)", "Village security"],
    images: [
      "https://picsum.photos/seed/subphiphat-p8-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p8-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p8-c/1200/800",
    ],
    verified: false,
    featured: false,
    status: "reserved",
    contactType: "LINE",
  },
  {
    id: "p9",
    slug: "central-hatyai-executive-condo",
    title: "Central Hat Yai Executive Condo",
    location: "Thanon Niphat Uthit 1, Central Hat Yai",
    district: "Central Hat Yai",
    price: 28500,
    propertyType: "Condo",
    bedrooms: 2,
    bathrooms: 2,
    size: 72,
    furnished: "Fully furnished",
    parking: true,
    wifi: true,
    availableDate: "2026-10-15",
    minimumLease: "12 months",
    deposit: "2 months rent + 1 month advance",
    description:
      "A higher-spec two-bedroom condo aimed at professionals and relocating families who want a fully equipped home within walking distance of Hat Yai's main commercial streets.",
    amenities: ["Swimming pool", "Fitness room", "Sky lounge", "24-hour security", "Fibre internet ready"],
    images: [
      "https://picsum.photos/seed/subphiphat-p9-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p9-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p9-c/1200/800",
    ],
    verified: true,
    featured: false,
    status: "available",
    contactType: "Email",
  },
  {
    id: "p10",
    slug: "kho-hong-budget-studio",
    title: "Kho Hong Budget Studio",
    location: "Kho Hong, Hat Yai",
    district: "Kho Hong",
    price: 5500,
    propertyType: "Apartment",
    bedrooms: 0,
    bathrooms: 1,
    size: 20,
    furnished: "Fully furnished",
    parking: false,
    wifi: false,
    availableDate: "2026-09-12",
    minimumLease: "1 month",
    deposit: "1 month rent + 1 month advance",
    description:
      "A simple, no-frills studio for tenants prioritising a low monthly cost. Basic furniture and appliances are included; a practical short-stay option while you get to know Hat Yai.",
    amenities: ["Communal laundry", "24-hour security", "Motorbike parking"],
    images: [
      "https://picsum.photos/seed/subphiphat-p10-a/1200/800",
      "https://picsum.photos/seed/subphiphat-p10-b/1200/800",
      "https://picsum.photos/seed/subphiphat-p10-c/1200/800",
    ],
    verified: false,
    featured: false,
    status: "available",
    contactType: "WhatsApp",
  },
];

export function getFeaturedProperties(limit = 6): Property[] {
  return properties.filter((p) => p.featured).slice(0, limit);
}

export function getPropertyBySlug(slug: string): Property | undefined {
  return properties.find((p) => p.slug === slug);
}

export function getRelatedProperties(current: Property, limit = 3): Property[] {
  return properties
    .filter((p) => p.id !== current.id && p.district === current.district)
    .slice(0, limit)
    .concat(
      properties.filter((p) => p.id !== current.id && p.district !== current.district)
    )
    .slice(0, limit);
}

export const districts: District[] = [
  "Central Hat Yai",
  "Kho Hong",
  "PSU / University Area",
  "Khlong Hae",
];

export const propertyTypes: PropertyType[] = ["Condo", "Apartment", "House", "Townhouse"];
