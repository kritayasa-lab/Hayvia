// -----------------------------------------------------------------------------
// POST /api/matching/contact
// -----------------------------------------------------------------------------
// Phase 4 — Matching Contact Capture. Lets a Get Matched visitor optionally
// attach an email to the run they just saw results for, WITHOUT the browser
// ever holding or sending a raw matching_preferences.id — only the signed,
// expiring contactToken returned by /api/match (see lib/matching/contact-token.ts
// for the token design and the accompanying security design report for the
// full threat model).
//
// The token is verified BEFORE any Supabase call is made — an invalid,
// expired, forged, or malformed token performs zero database access and
// returns the same generic error every time.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyContactToken } from "@/lib/matching/contact-token";
import { findOrCreateCustomer } from "@/lib/customers/identity";

export const dynamic = "force-dynamic";

interface ContactPayload {
  contactToken?: string;
  email?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const invalidResponse = () =>
  NextResponse.json({ success: false, error: "This link has expired or is invalid." }, { status: 400 });

export async function POST(request: Request) {
  let payload: ContactPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const contactToken = payload.contactToken?.trim();
  const email = payload.email?.trim();

  if (!contactToken || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ success: false, error: "A valid email is required." }, { status: 400 });
  }

  // Verify BEFORE touching Supabase at all — an invalid token never reaches
  // a database call.
  const verified = verifyContactToken(contactToken);
  if (!verified) {
    return invalidResponse();
  }
  const { matchingPreferenceId } = verified;

  const supabase = createAdminClient();

  const { data: preference, error: preferenceError } = await supabase
    .from("matching_preferences")
    .select("id")
    .eq("id", matchingPreferenceId)
    .maybeSingle();

  if (preferenceError || !preference) {
    // A verified-but-nonexistent id (row deleted, or a stale token from a
    // wiped dev database) is treated identically to an invalid token —
    // nothing about *why* it failed is revealed to the caller.
    return invalidResponse();
  }

  try {
    const customerResult = await findOrCreateCustomer({ email, firstSeenSource: "MATCHING" });
    if (customerResult.status === "conflict") {
      // eslint-disable-next-line no-console
      console.error(
        `[Subphiphat] Customer identity conflict on matching contact capture (email -> customer ${customerResult.emailCustomerId}, phone -> customer ${customerResult.phoneCustomerId}) — leaving customer_id unset for manual review.`
      );
      return NextResponse.json({ success: true });
    }

    const { customerId } = customerResult;

    // First-write-wins: only claim this run if it hasn't already been
    // claimed. Re-submitting the same still-valid token stays idempotent
    // either way (a no-op update on the second call), but a DIFFERENT email
    // replayed against the same token can never reassign an already-claimed
    // run to someone else.
    await supabase
      .from("matching_preferences")
      .update({ customer_id: customerId })
      .eq("id", matchingPreferenceId)
      .is("customer_id", null);

    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("matching_preference_id", matchingPreferenceId)
      .eq("source_type", "MATCHING")
      .maybeSingle();

    if (lead) {
      await supabase
        .from("leads")
        .update({ customer_id: customerId, customer_email: email })
        .eq("id", lead.id)
        .is("customer_id", null);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Matching contact capture failed:", error);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 502 });
  }
}
