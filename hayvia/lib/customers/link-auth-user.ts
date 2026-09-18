import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateCustomer } from "@/lib/customers/identity";

// -----------------------------------------------------------------------------
// Phase 5 — Customer Email OTP/Magic Link: links an authenticated
// Supabase Auth user (profiles.id / auth_user_id) to the correct
// `customers` row (customer_id), for the ONE moment this needs to happen —
// right after a magic link is successfully verified (see
// app/auth/confirm/route.ts).
//
// Reuses findOrCreateCustomer() (lib/customers/identity.ts) UNMODIFIED —
// the same exact-email resolution already used by every guest write path
// (inquiries, viewings, matching contact-capture). This file adds exactly
// one new thing on top: setting customers.profile_id, which
// findOrCreateCustomer() has never touched and still doesn't. There is
// still only one identity-resolution implementation in this codebase.
// -----------------------------------------------------------------------------

export interface ResolvedCustomer {
  customerId: string;
  fullName: string | null;
  email: string | null;
  /**
   * True the first time this auth user has ever been linked to a
   * customers row (a fresh customer row created just now, OR an existing
   * guest customer row — from a prior inquiry/viewing/matching submission
   * with the same email — linked for the first time). False if this
   * profile_id was already linked from an earlier login. Drives the
   * "Your account has been created" vs "Welcome back" distinction on
   * /account — always decided AFTER verification, never before.
   */
  isNewLink: boolean;
}

/**
 * Resolves (or creates) the customers row for a just-authenticated user.
 * Server-only — uses the service-role client, since `customers` has no
 * general authenticated write access (only the narrow, RLS-scoped SELECT
 * added by the Phase 5 migration). Idempotent: calling this again for an
 * already-linked profile_id is a cheap no-op read, never a duplicate link
 * or a duplicate customer.
 */
export async function resolveCustomerForAuthUser(
  profileId: string,
  email: string,
  fullName: string | null
): Promise<ResolvedCustomer> {
  const supabase = createAdminClient();

  // Fast path: already linked from a previous login.
  const { data: existing } = await supabase
    .from("customers")
    .select("id, full_name, email")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing) {
    return {
      customerId: existing.id,
      fullName: existing.full_name,
      email: existing.email,
      isNewLink: false,
    };
  }

  // First-time authentication for this auth user. Resolve-or-create by
  // email using the exact same identity resolution every guest write path
  // already uses. Phone is intentionally omitted — email is the only
  // verified identifier at login time — which also means the "conflict"
  // status can never occur here (it requires both email AND phone to
  // resolve to two different customers); handled defensively below anyway
  // rather than assumed away.
  const result = await findOrCreateCustomer({ email, fullName, firstSeenSource: "ACCOUNT" });

  if (result.status === "conflict") {
    throw new Error(
      `Unexpected identity conflict resolving customer for authenticated user ${profileId} (email -> customer ${result.emailCustomerId}, phone -> customer ${result.phoneCustomerId}).`
    );
  }

  const customerId = result.customerId;

  // First-write-wins guard — same discipline as the Phase 4 contact-token
  // linking (matching_preferences.customer_id). Guards against a
  // vanishingly unlikely concurrent-login race; a no-op here is always
  // safe since it means another concurrent call already won the link.
  await supabase.from("customers").update({ profile_id: profileId }).eq("id", customerId).is("profile_id", null);

  const { data: linked } = await supabase
    .from("customers")
    .select("id, full_name, email")
    .eq("id", customerId)
    .single();

  return {
    customerId,
    fullName: linked?.full_name ?? fullName,
    email: linked?.email ?? email,
    isNewLink: true,
  };
}
