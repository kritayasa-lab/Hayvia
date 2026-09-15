// -----------------------------------------------------------------------------
// Shared helper for forwarding a JSON payload to the Google Apps Script Web
// App configured in config/integrations.ts. Used by app/api/get-matched
// (generic lead forwarding) and app/api/match (best-effort notification
// alongside the real Supabase-backed matching flow) so both share the same
// fetch/parse/error handling instead of duplicating it.
// -----------------------------------------------------------------------------

import { GOOGLE_APPS_SCRIPT_URL } from "@/config/integrations";

export interface AppsScriptForwardResult {
  success: boolean;
  error?: string;
}

export async function forwardToGoogleAppsScript(payload: unknown): Promise<AppsScriptForwardResult> {
  if (!GOOGLE_APPS_SCRIPT_URL) {
    return { success: false, error: "Google Apps Script endpoint is not configured." };
  }

  let scriptResponse: Response;
  try {
    scriptResponse = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error reaching Google Apps Script.",
    };
  }

  const rawText = await scriptResponse.text();
  let parsed: { success?: boolean; error?: string } | null = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!scriptResponse.ok || (parsed && parsed.success === false)) {
    return { success: false, error: parsed?.error || `Apps Script returned status ${scriptResponse.status}.` };
  }

  return { success: true };
}
