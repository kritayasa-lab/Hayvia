import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request that passes through
 * middleware.ts. This is what keeps a user's session alive across page loads
 * without them noticing an access token silently expiring mid-visit — kept
 * because Supabase Auth itself is staying (admin authentication needs it),
 * even though the public site is guest-first and no longer has any
 * customer-facing login/account routes to protect.
 *
 * /admin/* is the one route tree this file actually guards: unauthenticated
 * visitors are redirected to /admin/login, and authenticated non-admins are
 * denied (also redirected to /admin/login, with a generic reason — this is a
 * fast, cheap early-exit so protected content is never even rendered for the
 * wrong caller). This is defense-in-depth on top of, not instead of, the
 * authoritative check in app/admin/(dashboard)/layout.tsx (requireAdmin(),
 * lib/auth/admin.ts) — a redirect here is only a UX/performance win, never
 * the only thing standing between a non-admin and admin data.
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

  return response;
}
