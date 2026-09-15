// -----------------------------------------------------------------------------
// Admin authorization helpers.
// -----------------------------------------------------------------------------
// Every /admin/* Server Component and every /api/admin/* Route Handler must
// call one of these before touching any privileged data. Both use the
// request's own session (lib/supabase/server.ts — anon key, respects RLS) to
// read `profiles.role`, which a signed-in user can always read for their own
// row (see migration 12's "Users can view own profile" policy) — no
// service-role client is needed just to check who's asking.
//
// Only after the caller is confirmed to be role = 'ADMIN' does admin code go
// on to use lib/supabase/admin.ts (service-role) for the actual privileged
// read/write — mirroring the exact pattern /api/inquiries and /api/viewings
// already use for guest writes (verify first, privileged client second).
// -----------------------------------------------------------------------------

import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string;
}

/**
 * Returns the signed-in admin, or null if there is no session or the
 * session's profile role isn't ADMIN. Never redirects — use this from
 * Route Handlers, which should respond with 401/403 JSON, not a redirect.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "ADMIN") return null;

  return {
    id: user.id,
    email: profile.email ?? user.email ?? null,
    fullName: profile.full_name ?? null,
    role: profile.role,
  };
}

/**
 * Same check as getAdminUser(), but redirects to /admin/login instead of
 * returning null. Use this at the top of every protected /admin/* Server
 * Component (in practice, once, in app/admin/(dashboard)/layout.tsx, which
 * every protected admin page is nested under).
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/admin/login");
  }
  return admin;
}
