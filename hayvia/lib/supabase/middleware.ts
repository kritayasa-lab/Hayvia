import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request that passes through
 * middleware.ts. This is what keeps a user's session alive across page loads
 * without them noticing an access token silently expiring mid-visit.
 *
 * Two route trees this file guards:
 * - /admin/*: unauthenticated visitors are redirected to /admin/login, and
 *   authenticated non-admins are denied (also redirected to /admin/login,
 *   with a generic reason — a fast, cheap early-exit so protected content is
 *   never even rendered for the wrong caller). Defense-in-depth on top of,
 *   not instead of, the authoritative check in
 *   app/admin/(dashboard)/layout.tsx (requireAdmin(), lib/auth/admin.ts).
 * - /account (Phase 5): unauthenticated visitors are redirected to /login.
 *   Same defense-in-depth relationship to the authoritative check in
 *   requireCustomerAccount() (lib/customers/account.ts) — this redirect is
 *   a UX/performance win, never the only thing standing between a guest
 *   and a customer's data. No role check here (unlike admin): any
 *   authenticated user may reach /account, since which customer they are
 *   is resolved by requireCustomerAccount() itself.
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
  // `response`.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminLoginRoute = pathname === "/admin/login";
  const isAccountRoute = pathname === "/account" || pathname.startsWith("/account/");

  if (isAdminRoute && !isAdminLoginRoute) {
    if (!user) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  if (isAccountRoute && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}
