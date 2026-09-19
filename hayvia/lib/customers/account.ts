import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// -----------------------------------------------------------------------------
// Phase 5 — /account data access.
//
// Deliberately uses lib/supabase/server.ts's session-respecting client
// throughout, NEVER the service-role client (lib/supabase/admin.ts) — the
// Phase 5 RLS migration (20260918100000) is what actually restricts every
// query below to the signed-in customer's own rows. This is the strongest
// available guarantee that "Customer A cannot read Customer B's data": the
// database enforces it, not this file's own filtering.
//
// Property display data is read exclusively through `public_properties`
// (the same privacy-safe view the public site itself reads through) —
// never the raw `properties` table, which carries owner/agent/source/
// commission/private_notes. This is a structural guarantee, not an
// omitted column: those fields are not present in the view at all.
// -----------------------------------------------------------------------------

export interface CustomerAccount {
  customerId: string;
  fullName: string | null;
  email: string | null;
  emailVerified: boolean;
}

export interface HistoryProperty {
  title: string;
  city: string | null;
  district: string | null;
  slug: string;
}

export interface InquiryHistoryRow {
  id: string;
  inquiryType: string;
  status: string;
  createdAt: string;
  property: HistoryProperty | null;
}

export interface ViewingHistoryRow {
  id: string;
  viewingType: string;
  status: string;
  preferredDate: string | null;
  createdAt: string;
  property: HistoryProperty | null;
}

export interface MatchingHistoryRow {
  id: string;
  purpose: string;
  location: string;
  createdAt: string;
}

export interface CustomerAccountData {
  account: CustomerAccount;
  inquiries: InquiryHistoryRow[];
  viewings: ViewingHistoryRow[];
  matching: MatchingHistoryRow[];
}

/**
 * The single entry point for /account. Same posture as requireAdmin()
 * (lib/auth/admin.ts) — authoritative server-side check, redirects rather
 * than returning null, since /account has exactly one caller.
 */
export async function requireCustomerAccount(): Promise<CustomerAccountData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: customer }] = await Promise.all([
    supabase.from("profiles").select("email, email_verified, full_name").eq("id", user.id).single(),
    supabase.from("customers").select("id, full_name, email").eq("profile_id", user.id).maybeSingle(),
  ]);

  if (!customer) {
    // Session exists but the customer link hasn't completed yet (e.g. the
    // best-effort link in app/auth/confirm failed) — nothing to show yet.
    // Bounce to /login rather than render a broken/empty account page; the
    // next successful login attempt will complete the link.
    redirect("/login");
  }

  const [{ data: inquiries }, { data: viewings }, { data: matching }] = await Promise.all([
    supabase
      .from("inquiries")
      .select("id, inquiry_type, status, created_at, property_id")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("viewings")
      .select("id, viewing_type, status, preferred_date, created_at, property_id")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("matching_preferences")
      .select("id, purpose, province, city, district, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
  ]);

  const propertyIds = Array.from(
    new Set(
      [...(inquiries ?? []).map((r) => r.property_id), ...(viewings ?? []).map((r) => r.property_id)].filter(
        (id): id is string => Boolean(id)
      )
    )
  );

  const propertiesById = new Map<string, HistoryProperty>();
  if (propertyIds.length > 0) {
    const { data: properties } = await supabase
      .from("public_properties")
      .select("id, title, city, district, slug")
      .in("id", propertyIds);
    for (const p of properties ?? []) {
      propertiesById.set(p.id, { title: p.title, city: p.city, district: p.district, slug: p.slug });
    }
  }

  return {
    account: {
      customerId: customer.id,
      fullName: customer.full_name ?? profile?.full_name ?? null,
      email: profile?.email ?? customer.email ?? null,
      emailVerified: profile?.email_verified ?? false,
    },
    inquiries: (inquiries ?? []).map((r) => ({
      id: r.id,
      inquiryType: r.inquiry_type,
      status: r.status,
      createdAt: r.created_at,
      property: r.property_id ? propertiesById.get(r.property_id) ?? null : null,
    })),
    viewings: (viewings ?? []).map((r) => ({
      id: r.id,
      viewingType: r.viewing_type,
      status: r.status,
      preferredDate: r.preferred_date,
      createdAt: r.created_at,
      property: r.property_id ? propertiesById.get(r.property_id) ?? null : null,
    })),
    matching: (matching ?? []).map((r) => ({
      id: r.id,
      purpose: r.purpose,
      location: [r.district, r.city, r.province].filter(Boolean).join(", ") || "No location preference",
      createdAt: r.created_at,
    })),
  };
}

export interface CustomerHeaderInfo {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * Lightweight, NEVER-REDIRECTING session summary for the public site
 * header (components/layout/Header.tsx, read once per request from the
 * root layout). Unlike requireCustomerAccount(), this must be safe to call
 * on every page the root layout wraps — including /admin/** and
 * /admin/login, since app/layout.tsx renders the public Header on every
 * route — so it only ever returns null on "nothing to show," never
 * redirects. An authenticated user with no linked customers row (e.g. an
 * admin who has never gone through the magic-link flow) also gets null —
 * there's no customer account to represent in this header.
 */
export async function getCustomerHeaderInfo(): Promise<CustomerHeaderInfo | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: customer }] = await Promise.all([
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("customers").select("full_name, email").eq("profile_id", user.id).maybeSingle(),
  ]);

  if (!customer) return null;

  return {
    fullName: customer.full_name,
    email: customer.email,
    avatarUrl: profile?.avatar_url ?? null,
  };
}
