// -----------------------------------------------------------------------------
// POST /api/matching/claim
// -----------------------------------------------------------------------------
// Phase 6 — claims a matching run for the CURRENTLY authenticated customer.
// Called from two places, both client-side in MatchingWizard:
//   1. "Unlock Property Details" clicked while already signed in — no login
//      round-trip needed, this call alone claims the run and unlocks it.
//   2. On return from a Magic Link login (the browser now carries a valid
//      session cookie) — called once on mount to confirm the claim server
//      side, since the client's in-memory matching state was lost across
//      the /login -> /auth/confirm -> back navigation.
//
// customerId is NEVER taken from the request body — it is always derived
// from the server-verified session via getUser() + resolveCustomerForAuthUser(),
// exactly like app/auth/confirm/route.ts already does for its own linking
// step. An unauthenticated caller gets a plain 401; the client is
// responsible for redirecting to /login in that case, this route never does.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveCustomerForAuthUser } from "@/lib/customers/link-auth-user";
import { claimMatchingRunForCustomer } from "@/lib/matching/claim";

export const dynamic = "force-dynamic";

interface ClaimPayload {
  contactToken?: string;
}

export async function POST(request: Request) {
  let payload: ClaimPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const contactToken = payload.contactToken?.trim();
  if (!contactToken) {
    return NextResponse.json({ success: false, error: "A valid unlock token is required." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  try {
    const resolved = await resolveCustomerForAuthUser(
      user.id,
      user.email,
      (user.user_metadata?.full_name as string | undefined) ?? null
    );
    const result = await claimMatchingRunForCustomer(contactToken, resolved.customerId, resolved.fullName, resolved.email);
    return NextResponse.json({ success: result.claimed });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Matching claim (authenticated) failed:", error);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 502 });
  }
}
