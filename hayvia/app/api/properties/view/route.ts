// -----------------------------------------------------------------------------
// POST /api/properties/view
// -----------------------------------------------------------------------------
// Called once by the browser when a property detail page loads (see the
// client-side ViewTracker component). This route is the only thing that
// tells Google Apps Script to increment a property's View Count — the
// browser never edits the Google Sheet directly.
//
// Browser → /api/properties/view → Google Apps Script (action: "incrementView") → Sheet
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { GOOGLE_APPS_SCRIPT_URL } from "@/config/integrations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const slug =
    body && typeof body === "object" && "slug" in body
      ? String((body as { slug?: unknown }).slug || "")
      : "";

  if (!slug) {
    return NextResponse.json(
      { success: false, error: "A property slug is required." },
      { status: 400 }
    );
  }

  if (!GOOGLE_APPS_SCRIPT_URL) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Missing Google Apps Script URL for view tracking.");
    return NextResponse.json(
      { success: false, error: "View tracking isn't connected yet." },
      { status: 500 }
    );
  }

  try {
    const scriptResponse = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "incrementView", slug }),
    });

    const rawText = await scriptResponse.text();
    let parsed: { success?: boolean; error?: string } | null = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    if (!scriptResponse.ok || !parsed || parsed.success !== true) {
      // eslint-disable-next-line no-console
      console.error(
        "[Subphiphat] Google Apps Script failed to increment view count:",
        scriptResponse.status,
        rawText
      );
      return NextResponse.json(
        { success: false, error: parsed?.error || "Failed to record view." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to reach Google Apps Script for view tracking:", error);
    // View tracking is non-critical — fail quietly with a 200-adjacent error
    // rather than surfacing anything to the visitor.
    return NextResponse.json(
      { success: false, error: "Network error while recording view." },
      { status: 502 }
    );
  }
}
