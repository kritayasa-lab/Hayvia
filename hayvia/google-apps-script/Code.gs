/**
 * Subphiphat Real Estate — Google Apps Script Web App
 * -----------------------------------------------------------------------
 * NOTE ON SHEET NAMES: the LEADS_SHEET_NAME and PROPERTIES_SHEET_NAME
 * constants below still point at "HAYVIA — Leads" / "HAYVIA — Properties"
 * on purpose — those are the literal tab names in the live Google Sheet.
 * Renaming them here without renaming the actual sheet tabs first would
 * break every lead submission and property fetch in production. If you
 * rename the tabs, update these two constants to match in the same change.
 * -----------------------------------------------------------------------
 * This file is NOT part of the Next.js app — it's a reference copy of the
 * code that should live in your Google Apps Script project (the one
 * deployed at the URL in config/integrations.ts). Paste this into the
 * Apps Script editor (Extensions > Apps Script, from your Google Sheet).
 *
 * This script now serves FOUR purposes, all through the same Web App
 * deployment:
 *
 *   1. doPost(e) with a normal Get Matched payload (no "action" field)
 *      -> appends a row to the "HAYVIA — Leads" sheet.
 *      This is the ORIGINAL, UNCHANGED behavior — see handleLeadSubmission()
 *      below, which is a verbatim copy of the previous doPost logic.
 *
 *   2. doGet(e) -> reads the "HAYVIA — Properties" sheet and returns all
 *      non-Hidden rows as JSON, keyed by header name.
 *
 *   3. doPost(e) with { "action": "incrementView", "slug": "..." }
 *      -> increments that property's View Count by 1. No lock (see
 *      handleIncrementView() below for why it was removed).
 *
 *   4. doPost(e) with { "action": "upsertProperty", "property": {...} }
 *      -> Supabase -> Sheets backup. Writes to a SEPARATE spreadsheet —
 *      SUBPHIPHAT REAL ESTATE — BACKUP, tab "Properties Backup"
 *      (BACKUP_SPREADSHEET_ID / BACKUP_PROPERTIES_SHEET_NAME below) — NOT
 *      the legacy HAYVIA spreadsheet every other handler in this file uses.
 *      Finds the existing row by ID and overwrites it in place, or appends
 *      a new row if no row with that ID exists yet. See
 *      handleUpsertProperty() below. IMPORTANT: only ever writes the
 *      public-safe fields lib/admin/sheets-backup.ts sends — owner/agent/
 *      source/commission/private notes are NEVER included in that payload,
 *      so they can never land in this sheet either.
 *
 * Response shape is always JSON, via ContentService:
 *   { "success": true, ... }
 *   { "success": false, "error": "..." }
 *
 * Because every request (leads, properties, view increments) now comes from
 * our Next.js API routes server-to-server — never directly from a browser —
 * CORS headers are not relevant anywhere in this file.
 * -----------------------------------------------------------------------
 */

var SPREADSHEET_ID = "15nxBmRBs185Mw3kIWoSlkVDp_KPxjvRYeCNkMo5LAJg";
var LEADS_SHEET_NAME = "HAYVIA — Leads";
var PROPERTIES_SHEET_NAME = "HAYVIA — Properties";

// Separate backup destination (SUBPHIPHAT REAL ESTATE — BACKUP). Used ONLY by
// handleUpsertProperty() below — every other handler in this file still
// reads/writes the legacy HAYVIA spreadsheet via SPREADSHEET_ID above,
// unchanged.
var BACKUP_SPREADSHEET_ID = "1LXS9kEaBk10TpnSR417_BFPjTCrMxUbhXHpa6cPNi4";
var BACKUP_PROPERTIES_SHEET_NAME = "Properties Backup";

// -----------------------------------------------------------------------
// doGet — reads HAYVIA — Properties
// -----------------------------------------------------------------------

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PROPERTIES_SHEET_NAME);
    if (!sheet) {
      return jsonResponse({
        success: false,
        error: "Properties sheet not found. Check PROPERTIES_SHEET_NAME in Code.gs.",
      });
    }

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      // Header row only (or empty sheet) — no properties yet, not an error.
      return jsonResponse({ success: true, properties: [] });
    }

    var headers = values[0];
    var properties = [];

    for (var r = 1; r < values.length; r++) {
      var row = values[r];

      // Skip completely empty rows.
      var isEmpty = row.every(function (cell) {
        return cell === "" || cell === null || cell === undefined;
      });
      if (isEmpty) continue;

      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        var header = String(headers[c]).trim();
        if (!header) continue;
        obj[header] = safeCellValue(row[c]);
      }

      // Never return Hidden properties publicly.
      var status = String(obj["Status"] || "").trim().toLowerCase();
      if (status === "hidden") continue;

      properties.push(obj);
    }

    return jsonResponse({ success: true, properties: properties });
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) });
  }
}

/**
 * Converts a single cell value into something safe to JSON-serialize —
 * mainly, Date objects (Apps Script represents date-formatted cells as JS
 * Date objects) become ISO strings instead of being silently mangled by
 * JSON.stringify's default Date handling quirks in some contexts.
 */
function safeCellValue(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    if (isNaN(value.getTime())) return "";
    return value.toISOString();
  }
  return value;
}

// -----------------------------------------------------------------------
// doPost — dispatches to view-count increment OR lead submission
// -----------------------------------------------------------------------

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "No form data received." });
    }

    var data = JSON.parse(e.postData.contents);

    if (data && data.action === "incrementView") {
      return handleIncrementView(data);
    }

    if (data && data.action === "upsertProperty") {
      return handleUpsertProperty(data);
    }

    // No "action" field -> this is a Get Matched lead submission, handled
    // exactly as before.
    return handleLeadSubmission(data);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) });
  }
}

/**
 * ORIGINAL Get Matched lead-submission logic — UNCHANGED from the previous
 * version of this file. Do not modify this function's behavior; the
 * Next.js side (app/api/get-matched/route.ts, lib/leads.ts) depends on it
 * staying exactly as-is.
 *
 * Sheet: "HAYVIA — Leads"
 * Columns (in exact order):
 *   Date | Name | Nationality | Contact Method | Contact Info |
 *   Property Type | Preferred Area | Budget | Bedrooms | Furnished |
 *   Parking | Move-in Date | Rental Duration | Occupants |
 *   Additional Requirements
 */
function handleLeadSubmission(data) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LEADS_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({
      success: false,
      error: "Leads sheet not found. Check the sheet name in Code.gs.",
    });
  }

  // Column order matches the sheet exactly:
  // Date | Name | Nationality | Contact Method | Contact Info |
  // Property Type | Preferred Area | Budget | Bedrooms | Furnished |
  // Parking | Move-in Date | Rental Duration | Occupants |
  // Additional Requirements
  sheet.appendRow([
    new Date(),                        // Date
    data.name || "",                   // Name
    data.nationality || "",            // Nationality
    data.contactMethod || "",          // Contact Method
    data.contactInfo || "",            // Contact Info
    data.propertyType || "",           // Property Type
    data.preferredArea || "",          // Preferred Area
    data.budget || "",                 // Budget
    data.bedrooms || "",               // Bedrooms
    data.furnished || "",              // Furnished
    data.parking || "",                // Parking
    data.moveInDate || "",             // Move-in Date
    data.rentalDuration || "",         // Rental Duration
    data.occupants || "",              // Occupants
    data.additionalRequirements || "", // Additional Requirements
  ]);

  return jsonResponse({ success: true });
}

/**
 * Increments View Count (column AF) for one property, matched by Slug
 * (falling back to ID if Slug is blank on that row).
 *
 * NO LOCK: previously used LockService.getScriptLock(), which is scoped to
 * the whole script project and was therefore shared with
 * handleUpsertProperty()'s lock below — an unrelated function writing to a
 * completely different spreadsheet. That sharing caused handleUpsertProperty
 * to intermittently fail with "Could not acquire lock in time." Removed
 * here (read-only audit confirmed this is safe — see the trade-off note
 * below); handleUpsertProperty's own lock is untouched.
 *
 * Trade-off: without a lock, two near-simultaneous views of the SAME
 * property could theoretically both read the same starting count and each
 * write back count+1, losing one increment. That's a low-stakes, self-
 * correcting cosmetic risk on a view counter — not duplicate rows, not data
 * loss on the property record itself, and unrelated to the Sheets backup's
 * idempotency guarantees (handleUpsertProperty, unchanged below).
 */
function handleIncrementView(data) {
  var slug = String(data.slug || "").trim();
  var id = String(data.id || "").trim();

  if (!slug && !id) {
    return jsonResponse({ success: false, error: "A property slug or id is required." });
  }

  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PROPERTIES_SHEET_NAME);
    if (!sheet) {
      return jsonResponse({ success: false, error: "Properties sheet not found." });
    }

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return jsonResponse({ success: false, error: "Property not found." });
    }

    var headers = values[0];
    var slugCol = headers.indexOf("Slug");
    var idCol = headers.indexOf("ID");
    var statusCol = headers.indexOf("Status");
    var viewCountCol = headers.indexOf("View Count");

    if (viewCountCol === -1) {
      return jsonResponse({
        success: false,
        error: 'View Count column not found. Add a "View Count" header in column AF.',
      });
    }

    var targetRowIndex = -1;
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var rowSlug = slugCol !== -1 ? String(row[slugCol] || "").trim() : "";
      var rowId = idCol !== -1 ? String(row[idCol] || "").trim() : "";

      if ((slug && rowSlug === slug) || (id && rowId === id)) {
        targetRowIndex = r;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return jsonResponse({ success: false, error: "Property not found." });
    }

    var targetRow = values[targetRowIndex];
    var status = statusCol !== -1 ? String(targetRow[statusCol] || "").trim().toLowerCase() : "";
    if (status === "hidden") {
      return jsonResponse({ success: false, error: "Cannot record a view for a hidden property." });
    }

    var currentCount = parseInt(targetRow[viewCountCol], 10);
    if (isNaN(currentCount)) currentCount = 0;

    // +1 header row, +1 for 1-indexed sheet rows/columns.
    var sheetRowNumber = targetRowIndex + 1;
    var sheetColNumber = viewCountCol + 1;
    sheet.getRange(sheetRowNumber, sheetColNumber).setValue(currentCount + 1);

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) });
  }
}

/**
 * Upserts one property row into the SEPARATE backup spreadsheet/tab
 * (BACKUP_SPREADSHEET_ID / "Properties Backup" — SUBPHIPHAT REAL ESTATE —
 * BACKUP), matched by ID (column "ID"). Looks up each column by header name
 * (like handleIncrementView above) rather than a hardcoded column index, so
 * it keeps working even if columns are reordered later, and so it only ever
 * writes columns that already exist as headers on that tab. Writes ONLY the
 * public-safe fields lib/admin/sheets-backup.ts sends — owner/agent/source/
 * commission/private-notes are never part of that payload, so they can never
 * appear here either. Deliberately targets a DIFFERENT spreadsheet than
 * every other handler in this file (doGet, handleLeadSubmission,
 * handleIncrementView all still use the legacy HAYVIA spreadsheet via
 * SPREADSHEET_ID, unchanged).
 *
 * Expected payload: { "action": "upsertProperty", "property": { "ID": "...",
 * "Status": "...", "Title": "...", ... one key per Properties Backup column ... } }
 */
function handleUpsertProperty(data) {
  var property = data.property || {};
  var id = String(property["ID"] || "").trim();

  if (!id) {
    return jsonResponse({ success: false, error: "Property ID is required." });
  }

  var lock = LockService.getScriptLock();
  var gotLock = false;

  try {
    gotLock = lock.waitLock(10000);
    if (!gotLock) {
      return jsonResponse({ success: false, error: "Could not acquire lock in time." });
    }

    var sheet = SpreadsheetApp.openById(BACKUP_SPREADSHEET_ID).getSheetByName(BACKUP_PROPERTIES_SHEET_NAME);
    if (!sheet) {
      return jsonResponse({
        success: false,
        error: "Backup Properties sheet not found. Check BACKUP_SPREADSHEET_ID / BACKUP_PROPERTIES_SHEET_NAME in Code.gs.",
      });
    }

    var values = sheet.getDataRange().getValues();
    var headers = values.length > 0 ? values[0] : [];

    if (headers.length === 0) {
      return jsonResponse({
        success: false,
        error: "Backup Properties sheet has no header row — cannot map columns.",
      });
    }

    var idCol = headers.indexOf("ID");
    if (idCol === -1) {
      return jsonResponse({ success: false, error: '"ID" column not found.' });
    }

    // Build the row to write, one cell per existing header, in the sheet's
    // OWN column order — so this keeps working regardless of what order the
    // Next.js side happens to send keys in, and never writes a column this
    // sheet doesn't already have.
    var rowValues = [];
    for (var c = 0; c < headers.length; c++) {
      var header = String(headers[c]).trim();
      var value = property.hasOwnProperty(header) ? property[header] : "";
      rowValues.push(value === null || value === undefined ? "" : value);
    }

    var targetRowIndex = -1;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idCol] || "").trim() === id) {
        targetRowIndex = r;
        break;
      }
    }

    if (targetRowIndex === -1) {
      sheet.appendRow(rowValues);
    } else {
      // +1 for 1-indexed sheet rows.
      sheet.getRange(targetRowIndex + 1, 1, 1, rowValues.length).setValues([rowValues]);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) });
  } finally {
    if (gotLock) {
      lock.releaseLock();
    }
  }
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
