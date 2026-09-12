// -----------------------------------------------------------------------------
// Integration endpoints
// -----------------------------------------------------------------------------
// Kept separate from config/contact.ts (which holds human-facing contact info)
// so backend/integration endpoints are easy to find and swap independently.
// -----------------------------------------------------------------------------

/**
 * Google Apps Script Web App URL for the Subphiphat Real Estate integration.
 * Deploy the Apps Script as a Web App (Execute as: Me, Who has access: Anyone),
 * then paste the resulting /exec URL here.
 *
 * This single endpoint now serves three purposes (see google-apps-script/Code.gs):
 *   - POST (Get Matched lead payload, no "action" field) -> appends to "HAYVIA — Leads"
 *   - GET                                                -> reads "HAYVIA — Properties"
 *   - POST { action: "incrementView", slug }             -> increments a property's View Count
 *
 * To point this at a different endpoint later (a new deployment, a different
 * backend entirely, etc.), this is the only line that needs to change.
 */
export const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx2QuPiwG2LcqG2m2ByhylgsJ88_ZsRqogLlKDyy-U4wMs6PeSa2_dFjyjYgvRKe9_IWQ/exec";
