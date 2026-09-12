// -----------------------------------------------------------------------------
// POST /api/get-matched
// -----------------------------------------------------------------------------
// Receives a Get Matched submission from the browser, forwards it server-side
// to the Google Apps Script Web App configured in config/integrations.ts, and
// relays a real, parsed success/failure result back to the client.
//
// Doing this server-to-server (instead of fetching Apps Script directly from
// the browser) avoids the Google Apps Script CORS limitation entirely, since
// there's no browser involved in the request to script.google.com — so we can
// read the actual response status and body instead of firing a `no-cors`
// request blind.
//
// This is a standard Next.js 14 App Router Route Handler and runs as a
// serverless function on Vercel with no extra configuration.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { GOOGLE_APPS_SCRIPT_URL } from "@/config/integrations";

// Always run this dynamically — it's a POST endpoint that forwards live form
// submissions, so it should never be cached or statically evaluated.
export const dynamic = "force-dynamic";

interface AppsScriptResponseBody {
  success?: boolean;
  error?: string;
}

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

  if (!GOOGLE_APPS_SCRIPT_URL) {
    // eslint-disable-next-line no-console
    console.error(
      "[Subphiphat] Missing Google Apps Script endpoint for Get Matched submissions."
    );
    return NextResponse.json(
      {
        success: false,
        error: "This form isn't connected yet. Please contact us directly.",
      },
      { status: 500 }
    );
  }

  let scriptResponse: Response;

  try {
    // Forward the complete form payload unchanged.
    scriptResponse = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to reach Google Apps Script:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Something went wrong sending your details. Please try again, or reach us directly via WhatsApp or email.",
      },
      { status: 502 }
    );
  }

  const rawText = await scriptResponse.text();
  let parsed: AppsScriptResponseBody | null = null;

  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    // Apps Script didn't return valid JSON — handled below.
    parsed = null;
  }

  if (!scriptResponse.ok) {
    // eslint-disable-next-line no-console
    console.error(
      "[Subphiphat] Google Apps Script returned an error status:",
      scriptResponse.status,
      rawText
    );
    return NextResponse.json(
      {
        success: false,
        error:
          parsed?.error ||
          "We couldn't reach our matching system right now. Please try again shortly.",
      },
      { status: 502 }
    );
  }

  if (parsed && parsed.success === false) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Google Apps Script reported failure:", parsed);
    return NextResponse.json(
      {
        success: false,
        error: parsed.error || "Something went wrong on our end. Please try again.",
      },
      { status: 502 }
    );
  }

  if (!parsed) {
    // Apps Script responded with a 2xx status but a body we couldn't parse as
    // JSON. Log it for visibility, but don't fail the submission on that
    // alone — the script did receive and presumably process the request.
    // eslint-disable-next-line no-console
    console.warn(
      "[Subphiphat] Google Apps Script returned a non-JSON response:",
      rawText
    );
  }

  return NextResponse.json({ success: true });
}
