// -----------------------------------------------------------------------------
// Browser Supabase client. Uses the anon (publishable) key only — this file
// is safe to import from Client Components. Never import lib/supabase/admin.ts
// here or anywhere client-reachable.
// -----------------------------------------------------------------------------

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
