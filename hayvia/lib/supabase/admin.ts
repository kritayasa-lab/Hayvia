// -----------------------------------------------------------------------------
// Privileged Supabase client using the SERVICE ROLE key. Bypasses RLS
// entirely. SERVER-ONLY — the `import "server-only"` line below makes Next.js
// fail the build if this file is ever imported into a Client Component, so
// misuse is caught at build time rather than discovered at runtime.
//
// Use this only for genuinely privileged, server-side operations where RLS
// is deliberately being bypassed with a specific reason (e.g. an admin API
// endpoint that's already independently verified the caller's role). Do not
// reach for this by default — lib/supabase/server.ts (which respects RLS as
// the current user) is almost always the right choice.
// -----------------------------------------------------------------------------

import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
