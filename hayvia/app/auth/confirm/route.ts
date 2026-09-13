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
//
// IMPORTANT: this route builds its own request/response-bound Supabase
// client (mirroring lib/supabase/middleware.ts's already-working pattern)
// instead of using lib/supabase/server.ts's createClient(). The session
// cookie verifyOtp() produces must be written directly onto the exact
// NextResponse this handler returns — using next/navigation's redirect()
// here (as an earlier version of this file did) does not reliably carry
// cookies queued via next/headers' cookies() through its throw-based
// redirect mechanism in a plain Route Handler, which was silently dropping
// the session cookie and sending confirmed users back to /login instead of
// /account. See the chat report for the full trace.
// -----------------------------------------------------------------------------

import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Only allow redirecting to a relative, same-site path. Rejects absolute
 * URLs and protocol-relative URLs (e.g. "//evil.com") to prevent this
 * public, unauthenticated endpoint from being used as an open redirect.
 */
function safeNextPath(rawNext: string | null): string {
  if (!rawNext) return "/account";
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) return "/account";
  return rawNext;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (token_hash && type) {
    // Built from the incoming request's own origin, which — because
    // Supabase's confirmation link is generated from whatever
    // NEXT_PUBLIC_SITE_URL was passed as emailRedirectTo at signup time —
    // is already the correct production host, never localhost, in
    // production.
    const redirectUrl = new URL(next, request.url);
    const response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Written directly onto the response we're about to return —
            // this is the fix. No dependency on next/headers' cookies().
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      return response;
    }
  }

  // Missing/invalid/expired link.
  return NextResponse.redirect(
    new URL("/login?error=Your verification link is invalid or has expired.", request.url)
  );
}