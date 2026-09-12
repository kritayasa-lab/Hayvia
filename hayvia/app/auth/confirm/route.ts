// -----------------------------------------------------------------------------
// GET /auth/confirm
// -----------------------------------------------------------------------------
// This is the URL Supabase Auth's emails link to — NOT a page a user
// navigates to directly. Handles every email-based verification type
// through one generic handler:
//   - type=signup        -> new account email confirmation
//   - type=recovery       -> password reset link
//   - type=email_change   -> confirming a newly linked/changed email
//
// Supabase's verifyOtp() (the same method used for phone codes) also
// handles these email link types via a token_hash rather than a 6-digit
// code — still entirely Supabase's own verification, nothing custom here.
// -----------------------------------------------------------------------------

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/account";

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      redirect(next);
    }
  }

  // Missing/invalid/expired link.
  return NextResponse.redirect(
    new URL("/login?error=Your verification link is invalid or has expired.", request.url)
  );
}
