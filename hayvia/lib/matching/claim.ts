import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyContactToken } from "@/lib/matching/contact-token";

// -----------------------------------------------------------------------------
// Phase 6 — claims a previously-run, guest-created matching_preferences row
// for an AUTHENTICATED customer. Reuses the exact same signed contactToken
// (lib/matching/contact-token.ts, unmodified) and the same first-write-wins
// UPDATE ... WHERE customer_id IS NULL pattern app/api/matching/contact/route.ts
// already uses for the Phase 4 email-capture flow — this is the authenticated
// counterpart of that same claim, never a new mechanism.
//
// customerId MUST come from a server-verified session (resolveCustomerForAuthUser()
// via an authenticated getUser() call) — this function trusts its caller on
// that point and performs no authentication itself. See callers:
// app/api/matching/claim/route.ts.
// -----------------------------------------------------------------------------

export interface ClaimResult {
  claimed: boolean;
  matchingPreferenceId: string | null;
}

/**
 * Verifies the token, then claims the run for `customerId` if it isn't
 * already claimed by someone else. Returns claimed: true only when this
 * exact customerId ends up owning the row — whether because this call just
 * claimed it, or because it was already claimed by this same customer on a
 * prior call (idempotent replay, e.g. clicking Unlock twice). Returns
 * claimed: false for an invalid/expired/tampered token, a missing row, or a
 * row already claimed by a DIFFERENT customer — a token replay can never
 * reassign or reveal another customer's run.
 */
export async function claimMatchingRunForCustomer(
  contactToken: string,
  customerId: string
): Promise<ClaimResult> {
  const verified = verifyContactToken(contactToken);
  if (!verified) {
    return { claimed: false, matchingPreferenceId: null };
  }
  const { matchingPreferenceId } = verified;

  const supabase = createAdminClient();

  // First-write-wins: only claim if unclaimed. A no-op if another
  // concurrent/prior call already claimed it — ownership is decided by the
  // re-read below, not by whether this particular UPDATE matched a row.
  await supabase
    .from("matching_preferences")
    .update({ customer_id: customerId })
    .eq("id", matchingPreferenceId)
    .is("customer_id", null);

  const { data: row, error } = await supabase
    .from("matching_preferences")
    .select("customer_id")
    .eq("id", matchingPreferenceId)
    .maybeSingle();

  if (error || !row) {
    return { claimed: false, matchingPreferenceId: null };
  }

  return { claimed: row.customer_id === customerId, matchingPreferenceId };
}
