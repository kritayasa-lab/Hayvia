// -----------------------------------------------------------------------------
// Province -> Amphoe (district-level administrative division) reference,
// for the Songkhla + Phuket dependent location selector (PR B).
// -----------------------------------------------------------------------------
// Deliberately separate from data/properties.ts's `districts`/`District`
// export, which lib/matching/* and app/api/match/route.ts depend on for an
// unrelated purpose (Get Matched's Hat Yai neighborhood/"preferred area"
// picker) -- that file is left completely untouched by this feature so the
// matching engine's behavior can't be affected, even indirectly.
//
// properties.city is Thailand's Amphoe (district) administrative level in
// this schema (e.g. "Hat Yai" = Amphoe Hat Yai of Songkhla) -- see
// PropertyForm.tsx and DATABASE_SCHEMA.md for the full province/city/
// district/subdistrict mapping. properties.district itself is a separate,
// unrelated free-text neighborhood/sub-area field (e.g. "Central Hat Yai")
// and keeps its existing meaning; nothing here changes it.
//
// V1 covers exactly the two target provinces. An unrecognized historical
// province/city value (anything outside this map) is handled by the caller
// (PropertyForm.tsx) falling back to free text -- this module never needs
// to represent "unknown" itself.
// -----------------------------------------------------------------------------

export const PROVINCES = ["Songkhla", "Phuket"] as const;

export type Province = (typeof PROVINCES)[number];

export function isKnownProvince(value: string): value is Province {
  return (PROVINCES as readonly string[]).includes(value);
}

// Real current Amphoe (district) lists. Songkhla has 16, Phuket has 3 --
// exact counts per the business requirement, not a placeholder subset.
export const PROVINCE_AMPHOE: Record<Province, readonly string[]> = {
  Songkhla: [
    "Mueang Songkhla",
    "Sathing Phra",
    "Chana",
    "Na Thawi",
    "Thepha",
    "Saba Yoi",
    "Ranot",
    "Krasae Sin",
    "Rattaphum",
    "Sadao",
    "Hat Yai",
    "Na Mom",
    "Khuan Niang",
    "Bang Klam",
    "Singhanakhon",
    "Khlong Hoi Khong",
  ],
  Phuket: ["Mueang Phuket", "Kathu", "Thalang"],
};
