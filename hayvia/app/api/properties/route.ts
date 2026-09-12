// -----------------------------------------------------------------------------
// GET /api/properties
// -----------------------------------------------------------------------------
// Browser-facing endpoint: the browser (or any client) calls this route, and
// this route is the only thing that talks to Google Apps Script for property
// data — so the browser never calls script.google.com directly.
//
// Server Components (the homepage, /properties, /properties/[slug]) call the
// shared `getProperties()` helper in lib/properties-source.ts directly rather
// than fetching this route internally — that avoids an unnecessary extra
// network hop on every page render. This route exists for any client-side
// consumer that needs the same data (and for parity with the architecture
// described for the Get Matched integration).
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
