import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// -----------------------------------------------------------------------------
// Customer Identity — Phase 3 (Admin Customer Profile / CRM).
//
// List-page fetcher only, matching the lib/admin/people.ts convention (a
// dedicated file per admin entity) rather than growing lib/admin/crm.ts.
// The detail page's loader stays inline in
// app/admin/(dashboard)/customers/[id]/page.tsx, matching the existing
// precedent in properties/[id], leads/[id], inquiries/[id], viewings/[id],
// and seller-leads/[id].
// -----------------------------------------------------------------------------

export interface CustomerRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  first_seen_source: string | null;
  created_at: string;
}

export async function fetchCustomers(): Promise<CustomerRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, email_verified, phone_verified, first_seen_source, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return data ?? [];
}
