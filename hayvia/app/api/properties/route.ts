// -----------------------------------------------------------------------------
// GET /api/properties
// -----------------------------------------------------------------------------
// Browser-facing endpoint for any client-side consumer of property data.
// Reads via the same getProperties() every Server Component uses — Supabase
// is the source of truth; Google Sheets is never read here or anywhere on
// the public site (see lib/properties-source.ts).
//
// Server Components (the homepage, /properties, /properties/[slug]) call the
// shared `getProperties()` helper in lib/properties-source.ts directly rather
// than fetching this route internally — that avoids an unnecessary extra
// network hop on every page render.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getProperties } from "@/lib/properties-source";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { properties, source } = await getProperties();
    return NextResponse.json({ success: true, properties, source });
  } catch (error) {
    // getProperties() already falls back internally and shouldn't normally
    // throw, but guard against any unexpected error so this route never
    // 500s into a blank response.
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] /api/properties failed unexpectedly:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load properties.", properties: [] },
      { status: 500 }
    );
  }
}
