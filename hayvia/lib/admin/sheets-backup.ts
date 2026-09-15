import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { GOOGLE_APPS_SCRIPT_URL } from "@/config/integrations";

// -----------------------------------------------------------------------------
// Supabase -> Google Sheets backup (Phase A, section 6).
//
// Writes ONLY the same public-safe columns "HAYVIA — Properties" has always
// had (A-AF) — this is the exact sheet the public website's Sheets fallback
// reads from (lib/properties-source.ts), so owner/agent/source/commission/
// private_notes must NEVER be included here. See google-apps-script/Code.gs's
// handleUpsertProperty() for the sheet-side half of this.
//
// Every call here is meant to be fire-and-forget from the caller's
// perspective (never awaited on the critical path, never able to fail a
// property save) — this module itself never throws; every failure is caught,
// logged to backup_logs, and returned as a result the caller can inspect if
// it wants to, but doesn't have to.
// -----------------------------------------------------------------------------

const statusToSheet: Record<string, string> = {
  PUBLISHED: "Available",
  RESERVED: "Reserved",
  RENTED: "Rented",
};

const propertyTypeToSheet: Record<string, string> = {
  CONDO: "Condo",
  APARTMENT: "Apartment",
  HOUSE: "House",
  TOWNHOUSE: "Townhouse",
};

const furnishedToSheet: Record<string, string> = {
  FULLY_FURNISHED: "Fully furnished",
  PARTIALLY_FURNISHED: "Partially furnished",
  UNFURNISHED: "Unfurnished",
};

interface BackupResult {
  success: boolean;
  error?: string;
}

/**
 * Backs up a single property (by its Supabase id) to Google Sheets. Always
 * resolves — never rejects — so a caller can safely `.catch(() => undefined)`
 * or just not await it at all. Logs the outcome to backup_logs either way.
 */
export async function backupPropertyToSheets(propertyId: string): Promise<BackupResult> {
  const supabase = createAdminClient();

  try {
    const [{ data: property, error: propertyError }, { data: images }, { data: amenityLinks }] =
      await Promise.all([
        supabase.from("properties").select("*").eq("id", propertyId).single(),
        supabase
          .from("property_images")
          .select("url")
          .eq("property_id", propertyId)
          .order("sort_order", { ascending: true }),
        supabase.from("property_amenities").select("amenities(name)").eq("property_id", propertyId),
      ]);

    if (propertyError || !property) {
      throw new Error(propertyError?.message ?? "Property not found.");
    }

    const amenityNames = (amenityLinks ?? [])
      .map((row) => (row.amenities as unknown as { name?: string } | null)?.name)
      .filter((name): name is string => Boolean(name));

    const sheetRow: Record<string, string> = {
      ID: property.external_ref || property.id,
      Status: statusToSheet[property.status] ?? "Hidden",
      Title: property.title ?? "",
      "Property Type": propertyTypeToSheet[property.property_type] ?? property.property_type ?? "",
      Area: property.district ?? "",
      "Monthly Rent": property.price != null ? String(property.price) : "",
      Bedrooms: property.bedrooms != null ? String(property.bedrooms) : "",
      Bathrooms: property.bathrooms != null ? String(property.bathrooms) : "",
      "Size (sqm)": property.size_sqm != null ? String(property.size_sqm) : "",
      Furnished: furnishedToSheet[property.furnished] ?? property.furnished ?? "",
      Parking: property.parking ? "Yes" : "No",
      "Available Date": property.available_date ?? "",
      "Minimum Rental": property.minimum_rental ?? "",
      Description: property.description ?? "",
      "Google Maps URL": property.google_maps_url ?? "",
      Slug: property.slug ?? "",
      Location: property.location ?? "",
      Deposit: property.deposit ?? "",
      Amenities: amenityNames.join(", "),
      WiFi: property.wifi ? "Yes" : "No",
      Verified: property.verified ? "Yes" : "No",
      Featured: property.featured ? "Yes" : "No",
      "Contact Type": property.contact_type ?? "",
      "View Count": property.view_count != null ? String(property.view_count) : "0",
    };

    (images ?? []).slice(0, 8).forEach((image, index) => {
      sheetRow[`Image ${index + 1}`] = image.url;
    });

    if (!GOOGLE_APPS_SCRIPT_URL) {
      throw new Error("Google Apps Script endpoint is not configured.");
    }

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsertProperty", property: sheetRow }),
    });

    const rawText = await response.text();
    let parsed: { success?: boolean; error?: string } | null = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok || parsed?.success !== true) {
      throw new Error(parsed?.error || `Apps Script returned status ${response.status}.`);
    }

    await logBackupAttempt(propertyId, "SUCCESS");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.error(`[Subphiphat Admin] Failed to back up property ${propertyId} to Sheets:`, error);
    await logBackupAttempt(propertyId, "FAILED", message);
    return { success: false, error: message };
  }
}

async function logBackupAttempt(propertyId: string, status: "SUCCESS" | "FAILED", errorMessage?: string) {
  try {
    const supabase = createAdminClient();
    await supabase.from("backup_logs").insert({
      entity_type: "property",
      entity_id: propertyId,
      action: "upsert",
      destination: "google_sheets:properties",
      status,
      error_message: errorMessage ?? null,
      synced_at: status === "SUCCESS" ? new Date().toISOString() : null,
    });
  } catch (logError) {
    // Logging the backup attempt failed too — never let this take down the
    // caller. Just surface it in server logs.
    // eslint-disable-next-line no-console
    console.error("[Subphiphat Admin] Failed to write backup_logs row:", logError);
  }
}

export interface BulkBackupReport {
  total: number;
  succeeded: number;
  failed: { propertyId: string; title: string; error: string }[];
}

/**
 * Backs up every property currently in Supabase to Google Sheets, one at a
 * time (Apps Script's LockService already serializes writes, and this
 * respects that rather than firing them all concurrently). Used by the
 * admin "Run Full Backup Now" action — an on-demand bulk export, distinct
 * from the automatic best-effort backup that runs after every admin
 * property save (see app/admin/(dashboard)/properties/actions.ts).
 */
export async function backupAllPropertiesToSheets(): Promise<BulkBackupReport> {
  const supabase = createAdminClient();
  const { data: properties } = await supabase.from("properties").select("id, title");

  const failed: BulkBackupReport["failed"] = [];
  let succeeded = 0;

  for (const property of properties ?? []) {
    const result = await backupPropertyToSheets(property.id);
    if (result.success) {
      succeeded += 1;
    } else {
      failed.push({ propertyId: property.id, title: property.title, error: result.error ?? "Unknown error" });
    }
  }

  return { total: (properties ?? []).length, succeeded, failed };
}
