import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface InquiryRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  inquiry_type: string;
  status: string;
  created_at: string;
  property_title: string;
}

export async function fetchInquiries(): Promise<InquiryRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inquiries")
    .select("id, name, email, phone, message, inquiry_type, status, created_at, properties(title)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    inquiry_type: row.inquiry_type,
    status: row.status,
    created_at: row.created_at,
    property_title: (row.properties as unknown as { title?: string } | null)?.title ?? "—",
  }));
}

export interface ViewingRow {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  viewing_type: string;
  preferred_date: string | null;
  preferred_time: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  property_title: string;
}

export async function fetchViewings(): Promise<ViewingRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("viewings")
    .select(
      "id, customer_name, customer_phone, customer_email, viewing_type, preferred_date, preferred_time, status, notes, created_at, properties(title)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((row) => ({
    id: row.id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    viewing_type: row.viewing_type,
    preferred_date: row.preferred_date,
    preferred_time: row.preferred_time,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    property_title: (row.properties as unknown as { title?: string } | null)?.title ?? "—",
  }));
}

export interface LeadRow {
  id: string;
  source_type: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  lead_type: string;
  status: string;
  follow_up_date: string | null;
  created_at: string;
  property_title: string | null;
}

export async function fetchLeads(): Promise<LeadRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, source_type, customer_name, customer_email, customer_phone, lead_type, status, follow_up_date, created_at, properties(title)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((row) => ({
    id: row.id,
    source_type: row.source_type,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    lead_type: row.lead_type,
    status: row.status,
    follow_up_date: row.follow_up_date,
    created_at: row.created_at,
    property_title: (row.properties as unknown as { title?: string } | null)?.title ?? null,
  }));
}

export interface SellerLeadRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  property_type: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  expected_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  status: string;
  created_at: string;
}

export async function fetchSellerLeads(): Promise<SellerLeadRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("seller_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export interface MatchingRunRow {
  id: string;
  purpose: string;
  province: string | null;
  city: string | null;
  district: string | null;
  budget_min: number | null;
  budget_max: number | null;
  property_type: string | null;
  bedrooms: number | null;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  topMatches: { propertyTitle: string; propertyCode: string | null; score: number }[];
}

export async function fetchMatchingRuns(): Promise<MatchingRunRow[]> {
  const supabase = createAdminClient();
  const { data: preferences } = await supabase
    .from("matching_preferences")
    .select(
      "id, purpose, province, city, district, budget_min, budget_max, property_type, bedrooms, created_at, customer_id, customers(full_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (!preferences || preferences.length === 0) return [];

  const results = await Promise.all(
    preferences.map(async ({ customers, ...pref }) => {
      const { data: matches } = await supabase
        .from("matching_results")
        .select("match_score, properties(title, property_code)")
        .eq("matching_preference_id", pref.id)
        .order("match_score", { ascending: false })
        .limit(3);

      const customer = customers as unknown as { full_name: string | null; email: string | null } | null;

      return {
        ...pref,
        customer_name: customer?.full_name || customer?.email || null,
        topMatches: (matches ?? []).map((m) => {
          const matchProperty = m.properties as unknown as { title?: string; property_code?: string } | null;
          return {
            propertyTitle: matchProperty?.title ?? "—",
            propertyCode: matchProperty?.property_code ?? null,
            score: Number(m.match_score),
          };
        }),
      };
    })
  );

  return results;
}

export interface MatchingRunDetail {
  preference: {
    id: string;
    purpose: string;
    province: string | null;
    city: string | null;
    district: string | null;
    budget_min: number | null;
    budget_max: number | null;
    property_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    furnished: string | null;
    parking: boolean | null;
    min_size_sqm: number | null;
    lifestyle_preferences: string[];
    created_at: string;
    customer_id: string | null;
  } | null;
  customer: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    email_verified: boolean;
    phone_verified: boolean;
  } | null;
  matches: {
    propertyId: string;
    propertyCode: string | null;
    propertyTitle: string;
    propertySlug: string;
    score: number;
  }[];
  hasInquiry: boolean;
  hasViewing: boolean;
}

/**
 * Everything the Admin Matching Request detail page needs, in one place.
 * Reads only existing tables/columns — no invented lifecycle state.
 * `hasInquiry`/`hasViewing` are a loose proxy (does this CUSTOMER have any
 * inquiry/viewing at all, not necessarily for one of these exact matched
 * properties) — the schema has no matching_preference_id link on those two
 * tables, so this is the closest honest signal available without adding one.
 */
export async function fetchMatchingRunDetail(id: string): Promise<MatchingRunDetail> {
  const supabase = createAdminClient();

  const { data: preference } = await supabase
    .from("matching_preferences")
    .select(
      "id, purpose, province, city, district, budget_min, budget_max, property_type, bedrooms, bathrooms, furnished, parking, min_size_sqm, lifestyle_preferences, created_at, customer_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!preference) {
    return { preference: null, customer: null, matches: [], hasInquiry: false, hasViewing: false };
  }

  const [{ data: matches }, customerResult] = await Promise.all([
    supabase
      .from("matching_results")
      .select("match_score, properties(id, title, slug, property_code)")
      .eq("matching_preference_id", id)
      .order("match_score", { ascending: false }),
    preference.customer_id
      ? supabase
          .from("customers")
          .select("id, full_name, email, phone, email_verified, phone_verified")
          .eq("id", preference.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let hasInquiry = false;
  let hasViewing = false;
  if (preference.customer_id) {
    const [{ count: inquiryCount }, { count: viewingCount }] = await Promise.all([
      supabase
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", preference.customer_id),
      supabase
        .from("viewings")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", preference.customer_id),
    ]);
    hasInquiry = Boolean(inquiryCount);
    hasViewing = Boolean(viewingCount);
  }

  return {
    preference,
    customer: customerResult.data,
    matches: (matches ?? []).map((m) => {
      const property = m.properties as unknown as
        | { id: string; title: string; slug: string; property_code: string | null }
        | null;
      return {
        propertyId: property?.id ?? "",
        propertyCode: property?.property_code ?? null,
        propertyTitle: property?.title ?? "—",
        propertySlug: property?.slug ?? "",
        score: Number(m.match_score),
      };
    }),
    hasInquiry,
    hasViewing,
  };
}
