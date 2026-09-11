// -----------------------------------------------------------------------------
// POST /api/get-matched
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { GOOGLE_APPS_SCRIPT_GET_MATCHED_URL } from "@/config/integrations";

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

  if (!GOOGLE_APPS_SCRIPT_GET_MATCHED_URL) {
    console.error(
      "[HAYVIA] Missing Google Apps Script endpoint for Get Matched submissions."
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
    scriptResponse = await fetch(GOOGLE_APPS_SCRIPT_GET_MATCHED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("[HAYVIA] Failed to reach Google Apps Script:", error);
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
    parsed = null;
  }

  if (!scriptResponse.ok) {
    console.error(
      "[HAYVIA] Google Apps Script returned an error status:",
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
    console.error("[HAYVIA] Google Apps Script reported failure:", parsed);
    return NextResponse.json(
      {
        success: false,
        error:
          parsed.error || "Something went wrong on our end. Please try again.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
