import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminPropertyRow {
  id: string;
  property_code: string;
  title: string;
  slug: string;
  listing_type: string;
  status: string;
  property_type: string;
  price: number;
  currency: string;
  city: string;
  district: string | null;
  featured: boolean;
  price_reduced: boolean;
  verified: boolean;
  view_count: number;
  created_at: string;
}

export async function fetchAdminProperties(filters: {
  listingType?: "RENT" | "BUY";
  q?: string;
}): Promise<AdminPropertyRow[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("properties")
    .select(
      "id, property_code, title, slug, listing_type, status, property_type, price, currency, city, district, featured, price_reduced, verified, view_count, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.listingType) {
    query = query.eq("listing_type", filters.listingType);
  }

  if (filters.q) {
    const term = filters.q.trim();
    if (term) {
      // Search priority: exact Property Code (Phase 8A business identity,
      // case-insensitive — "sp-000127" and "SP-000127" both match) > exact
      // UUID > exact external_ref > free-text title/city/district.
      const isUuid = /^[0-9a-f-]{36}$/i.test(term);
      const isPropertyCode = /^SP-\d{6,}$/i.test(term);
      if (isPropertyCode) {
        query = query.ilike("property_code", term);
      } else if (isUuid) {
        query = query.eq("id", term);
      } else {
        query = query.or(
          `title.ilike.%${term}%,city.ilike.%${term}%,district.ilike.%${term}%,external_ref.eq.${term}`
        );
      }
    }
  }

  const { data, error } = await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat Admin] Failed to load properties:", error);
    return [];
  }
  return data ?? [];
}
