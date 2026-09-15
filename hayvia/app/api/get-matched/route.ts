// -----------------------------------------------------------------------------
// POST /api/get-matched
// -----------------------------------------------------------------------------
// Generic forwarder to the Google Apps Script Web App configured in
// config/integrations.ts — kept as a thin Route Handler over
// lib/google-apps-script.ts so the browser never talks to Apps Script
// directly (avoiding its CORS limitation) and so any legacy caller of this
// exact endpoint keeps working. The real /get-matched page now talks to
// /api/match instead, which uses the same shared helper as a best-effort
// notification alongside its real Supabase-backed matching flow.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { forwardToGoogleAppsScript } from "@/lib/google-apps-script";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const result = await forwardToGoogleAppsScript(payload);

  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to forward lead to Google Apps Script:", result.error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Something went wrong sending your details. Please try again, or reach us directly via WhatsApp or email.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
