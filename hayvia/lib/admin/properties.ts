import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminPropertyRow {
  id: string;
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
      "id, title, slug, listing_type, status, property_type, price, currency, city, district, featured, price_reduced, verified, view_count, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.listingType) {
    query = query.eq("listing_type", filters.listingType);
  }

  if (filters.q) {
    const term = filters.q.trim();
    if (term) {
      // Search by title, city/district ("location"), or a direct id match —
      // matches the brief's "Search by title, ID, location".
      const isUuid = /^[0-9a-f-]{36}$/i.test(term);
      query = isUuid
        ? query.eq("id", term)
        : query.or(`title.ilike.%${term}%,city.ilike.%${term}%,district.ilike.%${term}%`);
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
