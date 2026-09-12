// -----------------------------------------------------------------------------
// Server-side Supabase client for use in Server Components, Server Actions,
// and Route Handlers. Uses the anon key + the request's own session cookies
// (via next/headers) — this respects RLS as the currently signed-in user,
// exactly like the browser client does. It does NOT bypass RLS.
//
// For privileged, RLS-bypassing operations, use lib/supabase/admin.ts
// instead — and only from server-only code.
// -----------------------------------------------------------------------------

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component (not a Server Action/Route
            // Handler) — cookies can't be written there. Safe to ignore as
            // long as middleware.ts is also refreshing the session, which
            // it is (see middleware.ts).
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // See note above.
          }
        },
      },
    }
  );
}
