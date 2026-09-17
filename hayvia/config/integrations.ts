// -----------------------------------------------------------------------------
// Integration endpoints
// -----------------------------------------------------------------------------
// Kept separate from config/contact.ts (which holds human-facing contact info)
// so backend/integration endpoints are easy to find and swap independently.
// -----------------------------------------------------------------------------

/**
 * Google Apps Script Web App URL for the LEGACY "HAYVIA" project
 * (google-apps-script/Code.gs). Still used for the two purposes that script
 * still owns:
 *   - POST (Get Matched lead payload, no "action" field) -> appends to "HAYVIA — Leads"
 *     (lib/google-apps-script.ts, used by app/api/get-matched and app/api/match)
 *   - GET -> reads "HAYVIA — Properties"
 *     (lib/properties-source.ts's fetchPropertiesFromSheet(), used ONLY by
 *     the isolated, manual lib/admin/legacy-sheets-import.ts — never by the
 *     public site's read path, which is Supabase-only)
 *
 * Property-view-count tracking and Supabase -> Sheets backup no longer use
 * this URL — see GOOGLE_APPS_SCRIPT_BACKUP_URL below for backup, and
 * app/api/properties/view/route.ts (writes to Supabase directly) for view
 * counts.
 */
export const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx2QuPiwG2LcqG2m2ByhylgsJ88_ZsRqogLlKDyy-U4wMs6PeSa2_dFjyjYgvRKe9_IWQ/exec";

/**
 * Google Apps Script Web App URL for the NEW, standalone, backup-only
 * project (see the "Properties Backup" Code.gs reviewed and approved
 * separately from google-apps-script/Code.gs — this repo does not currently
 * keep a copy of that script's source). Supports exactly one action,
 * { "action": "upsertProperty", "property": {...} }, and writes only to the
 * "SUBPHIPHAT REAL ESTATE — BACKUP" spreadsheet's "Properties Backup" tab.
 *
 * Used ONLY by lib/admin/sheets-backup.ts. Does not implement Get Matched,
 * property reads, or view counting — do not point lib/google-apps-script.ts
 * or lib/properties-source.ts's fetchPropertiesFromSheet() at this URL.
 */
export const GOOGLE_APPS_SCRIPT_BACKUP_URL =
  "https://script.google.com/macros/s/AKfycbzl2Wo6qXvX5M5F0Qs2C2QVsuXbgoMksbjLdbfJaD8EMzwJgTUmwl97Jln6gOEaQycjGA/exec";
