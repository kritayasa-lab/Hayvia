/**
 * The site's own base URL, used to build Supabase Auth redirect links
 * (email confirmation, password reset). Falls back to localhost for local
 * development. Set NEXT_PUBLIC_SITE_URL in Vercel's environment variables
 * for production — see .env.example.
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
