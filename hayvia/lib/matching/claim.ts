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
// Phase 6.1 — also links the corresponding CRM `leads` row (source_type =
// 'MATCHING', matching_preference_id = this run) to the same customer, using
// the identical "find the one lead for this run, update it if unclaimed"
// pattern app/api/matching/contact/route.ts already established — no new
// relationship, just applying the existing one from the authenticated path
// too. Without this, matching_preferences.customer_id was correctly linked
// but the Admin-visible lead stayed "Unnamed Lead / Email — / Phone —".
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
 *
 * `customerName`/`customerEmail` are optional, display-only denormalized
 * values written onto the linked `leads` row (same columns the Phase 4 path
 * already writes) — never used for any ownership/security decision, which
 * is entirely governed by `customerId` and the first-write-wins update above.
 */
export async function claimMatchingRunForCustomer(
  contactToken: string,
  customerId: string,
  customerName?: string | null,
  customerEmail?: string | null
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

  const claimed = row.customer_id === customerId;

  if (claimed) {
    // Same scoping as app/api/matching/contact/route.ts: only the one lead
    // that belongs to this exact matching run, never a broader match — and
    // only if it isn't already linked to someone else.
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("matching_preference_id", matchingPreferenceId)
      .eq("source_type", "MATCHING")
      .maybeSingle();

    if (lead) {
      await supabase
        .from("leads")
        .update({
          customer_id: customerId,
          ...(customerName ? { customer_name: customerName } : {}),
          ...(customerEmail ? { customer_email: customerEmail } : {}),
        })
        .eq("id", lead.id)
        .is("customer_id", null);
    }
  }

  return { claimed, matchingPreferenceId };
}
