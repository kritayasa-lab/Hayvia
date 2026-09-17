import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeToE164 } from "@/lib/auth/phone";
import { lookupCustomerByContact, normalizeEmail, type CustomerRow } from "@/lib/customers/lookup";

// -----------------------------------------------------------------------------
// Customer Identity Foundation — Phase 1.
//
// findOrCreateCustomer() is the ONLY intended write path for `customers`.
// Nothing calls it yet — no existing form/route (inquiries, viewings,
// seller-leads, matching, leads) is wired to it in this phase. It exists so
// a later phase can attach `customer_id` to those tables without inventing
// this resolution logic ad hoc at each call site.
//
// Matching rule: exact normalized email and/or exact normalized phone
// (E.164) ONLY. Never fuzzy-matched, never matched by name — a name is
// never enough evidence that two records are the same person.
// -----------------------------------------------------------------------------

export interface FindOrCreateCustomerInput {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  /** e.g. "INQUIRY" | "VIEWING" | "MATCHING" | "SELLER_LEAD" | "ACCOUNT" — only used when actually creating a new customer. */
  firstSeenSource?: string | null;
}

export interface CustomerResolved {
  status: "matched" | "created";
  customerId: string;
}

/**
 * Returned when the given email and phone each match a DIFFERENT existing
 * customer. This is a genuine identity conflict, not something this
 * function will ever resolve on its own — merging two possibly-unrelated
 * people because they share one submitted field is exactly the kind of
 * silent-merge bug the design review flagged. The caller gets both ids back
 * so it can proceed without a customer_id (or flag it for staff review) —
 * nothing is written to `customers` in this case.
 */
export interface CustomerConflict {
  status: "conflict";
  emailCustomerId: string;
  phoneCustomerId: string;
}

export type FindOrCreateCustomerResult = CustomerResolved | CustomerConflict;

/**
 * Finds or creates the single `customers` row representing a real person.
 * Server-side only — `customers` has no anon/authenticated grants at all
 * (same treatment as `owners`/`agents`), so this only ever runs through the
 * service-role client, exactly like every other lib/admin/* and
 * lib/supabase/* write path in this codebase.
 *
 * Race-safety: this does a real insert-then-fallback-to-lookup on a unique
 * constraint violation (the same pattern syncPropertyAmenities() already
 * uses in lib/supabase/properties-sync.ts for concurrent amenity creation),
 * relying on the partial unique indexes on `email` and `phone_e164` from
 * the Phase 1 migration — so two concurrent submissions for the same new
 * email/phone can never create two customer rows; both calls converge on
 * whichever insert actually won.
 */
export async function findOrCreateCustomer(
  input: FindOrCreateCustomerInput
): Promise<FindOrCreateCustomerResult> {
  const email = normalizeEmail(input.email);
  const phone = input.phone?.trim() || null;
  const phoneE164 = phone ? normalizeToE164(phone) : null;
  const fullName = input.fullName?.trim() || null;

  const supabase = createAdminClient();

  const lookup = await lookupCustomerByContact(supabase, email, phoneE164);

  if (lookup.status === "conflict") {
    return {
      status: "conflict",
      emailCustomerId: lookup.emailMatch!.id,
      phoneCustomerId: lookup.phoneMatch!.id,
    };
  }

  if (lookup.status === "matched") {
    const existing = lookup.customer as CustomerRow;
    // Fill in only what's currently missing on this customer — never
    // overwrite an already-known contact channel with a fresh, unverified
    // one from this submission. Phase 1 has no verification flow yet, so
    // "already present" is the safest stand-in for "don't downgrade
    // verified data" until phone/email verification actually exists.
    const patch: Record<string, string> = {};
    if (!existing.full_name && fullName) patch.full_name = fullName;
    if (!existing.email && email) patch.email = email;
    if (!existing.phone_e164 && phoneE164) {
      patch.phone_e164 = phoneE164;
      if (phone) patch.phone = phone;
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabase.from("customers").update(patch).eq("id", existing.id);
      if (updateError) {
        // Lost a race: the email/phone being attached here was just
        // claimed by a different customer via a concurrent call (unique
        // constraint violation). Leave this customer's row as-is rather
        // than failing the whole resolution — the caller still gets back
        // a valid, existing customer id.
        // eslint-disable-next-line no-console
        console.error(`[Subphiphat] Failed to update customer ${existing.id} contact info:`, updateError);
      }
    }

    return { status: "matched", customerId: existing.id };
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      full_name: fullName,
      email,
      phone,
      phone_e164: phoneE164,
      first_seen_source: input.firstSeenSource ?? null,
    })
    .select("id")
    .single();

  if (!error && created) {
    return { status: "created", customerId: created.id as string };
  }

  // Lost a race to a concurrent insert with the same email or phone — the
  // partial unique index rejected this insert. Re-resolve by looking the
  // row up again instead of failing, same pattern as
  // syncPropertyAmenities() in lib/supabase/properties-sync.ts.
  const [retryByEmail, retryByPhone] = await Promise.all([
    email
      ? supabase.from("customers").select("id").eq("email", email).maybeSingle()
      : Promise.resolve({ data: null }),
    phoneE164
      ? supabase.from("customers").select("id").eq("phone_e164", phoneE164).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const winner =
    (retryByEmail.data as { id: string } | null) ?? (retryByPhone.data as { id: string } | null) ?? null;

  if (winner) {
    return { status: "matched", customerId: winner.id };
  }

  throw new Error(`Failed to create customer: ${error?.message ?? "unknown error"}`);
}
