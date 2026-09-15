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
  topMatches: { propertyTitle: string; score: number }[];
}

export async function fetchMatchingRuns(): Promise<MatchingRunRow[]> {
  const supabase = createAdminClient();
  const { data: preferences } = await supabase
    .from("matching_preferences")
    .select("id, purpose, province, city, district, budget_min, budget_max, property_type, bedrooms, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!preferences || preferences.length === 0) return [];

  const results = await Promise.all(
    preferences.map(async (pref) => {
      const { data: matches } = await supabase
        .from("matching_results")
        .select("match_score, properties(title)")
        .eq("matching_preference_id", pref.id)
        .order("match_score", { ascending: false })
        .limit(3);

      return {
        ...pref,
        topMatches: (matches ?? []).map((m) => ({
          propertyTitle: (m.properties as unknown as { title?: string } | null)?.title ?? "—",
          score: Number(m.match_score),
        })),
      };
    })
  );

  return results;
}
