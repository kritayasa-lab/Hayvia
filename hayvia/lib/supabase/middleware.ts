import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request that passes through
 * middleware.ts. This is what keeps a user's session alive across page loads
 * without them noticing an access token silently expiring mid-visit — kept
 * because Supabase Auth itself is staying (admin authentication will need
 * it), even though the public site is guest-first and no longer has any
 * customer-facing login/account routes to protect.
 *
 * There is no /admin route yet. When one is added, its own
 * "logged in + role === ADMIN" guard belongs here (redirecting to wherever
 * the admin login page ends up living) — deliberately not added speculatively
 * now, since there's nothing to protect yet.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Calling getUser() (rather than just reading the cookie) is what
  // actually triggers Supabase to refresh an expired access token — that
  // refresh is what the set()/remove() callbacks above capture into
  // `response`. No route-based redirect decision is made here anymore; see
  // the file-level comment for why.
  await supabase.auth.getUser();

  return response;
}
