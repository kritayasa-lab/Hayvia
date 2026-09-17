// -----------------------------------------------------------------------------
// Read-only customer identity lookup — the ONE implementation of "given a
// normalized email and/or normalized E.164 phone, which existing customers
// row (if any) do they resolve to."
//
// Deliberately NOT `import "server-only"`: it holds no secrets and creates
// no client itself (the caller supplies an already-constructed Supabase
// client), so it's safe to import from both the live Next.js write path
// (lib/customers/identity.ts's findOrCreateCustomer()) and a standalone
// Node script (scripts/backfill-customers-dry-run.ts, Phase 5A). The
// latter runs outside Next's bundler, so anything transitively importing
// `import "server-only"` (e.g. lib/supabase/admin.ts, lib/auth/phone.ts)
// would throw immediately — this module and its callers avoid that by
// taking an already-built client and already-normalized values instead of
// constructing/normalizing anything privileged themselves.
//
// Extracting this out of findOrCreateCustomer() means the live write path
// and the Phase 5 read-only backfill audit can never drift apart on what
// counts as a match vs. a conflict: exact normalized email and/or exact
// normalized E.164 phone ONLY — never fuzzy, never by name — and a result
// is "matched" only when email and phone agree (one present, or both
// present and pointing at the same row); if they resolve to two different
// existing customers, that's a "conflict", never silently resolved.
// -----------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CustomerRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
}

export type CustomerLookupStatus = "matched" | "conflict" | "new";

export interface CustomerLookupResult {
  status: CustomerLookupStatus;
  /** Set only when status is "matched" — the single agreed-upon customer. */
  customer: CustomerRow | null;
  /** The row (if any) found by normalized email — set for "matched" and "conflict". */
  emailMatch: CustomerRow | null;
  /** The row (if any) found by normalized E.164 phone — set for "matched" and "conflict". */
  phoneMatch: CustomerRow | null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

/**
 * Issues exactly two SELECTs (by normalized email, by normalized E.164
 * phone) against `customers` and classifies the result. Never writes.
 */
export async function lookupCustomerByContact(
  supabase: SupabaseClient,
  normalizedEmail: string | null,
  normalizedPhoneE164: string | null
): Promise<CustomerLookupResult> {
  const [byEmail, byPhone] = await Promise.all([
    normalizedEmail
      ? supabase
          .from("customers")
          .select("id, full_name, email, phone, phone_e164")
          .eq("email", normalizedEmail)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    normalizedPhoneE164
      ? supabase
          .from("customers")
          .select("id, full_name, email, phone, phone_e164")
          .eq("phone_e164", normalizedPhoneE164)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const emailMatch = (byEmail.data as CustomerRow | null) ?? null;
  const phoneMatch = (byPhone.data as CustomerRow | null) ?? null;

  if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
    return { status: "conflict", customer: null, emailMatch, phoneMatch };
  }

  const existing = emailMatch ?? phoneMatch;
  if (existing) {
    return { status: "matched", customer: existing, emailMatch, phoneMatch };
  }

  return { status: "new", customer: null, emailMatch: null, phoneMatch: null };
}
