// -----------------------------------------------------------------------------
// GET /auth/confirm
// -----------------------------------------------------------------------------
// This is the URL Supabase Auth's emails link to — NOT a page a user
// navigates to directly. Handles every email-based verification type
// through one generic handler, across TWO possible Supabase Auth link
// shapes:
//   - Implicit/OTP flow: ?token_hash=...&type=...  -> verifyOtp()
//       type=signup        -> new account email confirmation (password flow)
//       type=recovery      -> password reset link (password flow)
//       type=email_change  -> confirming a newly linked/changed email
//       type=magiclink/email -> Phase 5 passwordless customer login
//   - PKCE flow: ?code=...  -> exchangeCodeForSession()
//       Supabase's project-wide "Auth Flow Type" setting decides which
//       shape EVERY email link uses (not chosen per-call by this app) —
//       PRODUCTION FIX: a live magic-link test landed at "/?code=..."
//       instead of "/auth/confirm?...", which is the unambiguous signature
//       of PKCE. This route previously only handled the token_hash/type
//       shape, so a PKCE `code` arriving here would have fallen straight
//       through to "invalid or expired" without ever establishing a
//       session — the flow was broken end-to-end, not just missing a UI
//       indicator. (Landing on "/" instead of "/auth/confirm" is a
//       SEPARATE, still-outstanding issue: Supabase falls back to its
//       Dashboard-configured Site URL when `emailRedirectTo` isn't in the
//       allow-listed Redirect URLs — that's a Dashboard config change, not
//       something this file can fix.)
//
// Under PKCE, `type` is never present — only `code`. In this codebase's
// current reachable UI, a `code` arriving here can only come from the
// Phase 5 magic-link flow: admin auth is signInWithPassword only (never an
// email link, see lib/auth/admin-actions.ts), and the password-based email
// actions in lib/auth/actions.ts are unreferenced by any live page. So a
// successful PKCE exchange is treated the same as a magiclink/email
// verification for customer-linking purposes below.
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
import { resolveCustomerForAuthUser } from "@/lib/customers/link-auth-user";

// The two EmailOtpType values Supabase uses for a passwordless
// signInWithOtp({ email }) link, depending on SDK/template version — both
// are the customer-login case, never signup/recovery/email_change.
const CUSTOMER_LOGIN_EMAIL_TYPES = new Set(["magiclink", "email"]);

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
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const hasOtpParams = Boolean(token_hash && type);
  const hasPkceCode = Boolean(code);

  if (hasOtpParams || hasPkceCode) {
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

    const { error } = hasPkceCode
      ? await supabase.auth.exchangeCodeForSession(code!)
      : await supabase.auth.verifyOtp({ type: type!, token_hash: token_hash! });

    if (!error) {
      const isCustomerLoginEvent = hasPkceCode || CUSTOMER_LOGIN_EMAIL_TYPES.has(type as string);

      if (isCustomerLoginEvent) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user?.email) {
          try {
            const resolved = await resolveCustomerForAuthUser(
              user.id,
              user.email,
              (user.user_metadata?.full_name as string | undefined) ?? null
            );
            redirectUrl.searchParams.set("welcome", resolved.isNewLink ? "new" : "back");
            // The cookies set() callbacks above already wrote onto
            // `response` — updating the Location header directly (rather
            // than constructing a new NextResponse.redirect) is what lets
            // the final redirect target reflect resolveCustomerForAuthUser's
            // result without losing the session cookie already attached
            // to this exact response object.
            response.headers.set("location", redirectUrl.toString());
          } catch (linkError) {
            // Best-effort: never block a successful login over a linking
            // failure — same posture as every other findOrCreateCustomer()
            // caller in this codebase. Logged for manual follow-up; the
            // session is still valid, /account will simply show no
            // history until this is resolved.
            // eslint-disable-next-line no-console
            console.error(
              "[Subphiphat] Failed to resolve customer for authenticated user after magic link verification:",
              linkError
            );
          }
        }
      }

      return response;
    }
  }

  // Missing/invalid/expired link.
  return NextResponse.redirect(
    new URL("/login?error=Your verification link is invalid or has expired.", request.url)
  );
}