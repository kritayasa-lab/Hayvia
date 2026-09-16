// -----------------------------------------------------------------------------
// POST /api/properties/view
// -----------------------------------------------------------------------------
// Called once by the browser when a property detail page loads (see the
// client-side ViewTracker component). Increments properties.view_count in
// Supabase directly — Supabase is the source of truth for property data
// (including view counts, which feed the homepage's "Most Viewed" section),
// so this no longer goes through Google Apps Script/Sheets at all.
//
// Browser -> /api/properties/view -> Supabase (service-role, server-only)
//
// Deliberately NOT mirrored to the Sheets backup: the backup sync
// (lib/admin/sheets-backup.ts) runs after an ADMIN property save, not on
// every public page view — mirroring every single view here would mean a
// Google Apps Script POST per page load, which is unnecessary traffic this
// architecture doesn't call for. The next admin save (or a manual "Run Full
// Backup Now") will carry the current view count over.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  try {
    const supabase = createAdminClient();

    const { data: property, error: findError } = await supabase
      .from("properties")
      .select("id, view_count")
      .eq("slug", slug)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    if (!property) {
      // Not every slug the public site can render is guaranteed to exist in
      // Supabase (e.g. the demo-data fallback, which is only ever used when
      // Supabase itself is unreachable/empty) — view tracking is non-
      // critical, so this is a quiet no-op, not an error.
      return NextResponse.json({ success: true, tracked: false });
    }

    const { error: updateError } = await supabase
      .from("properties")
      .update({ view_count: (property.view_count ?? 0) + 1 })
      .eq("id", property.id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ success: true, tracked: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to increment property view count:", error);
    // View tracking is non-critical — fail quietly, never surface anything
    // to the visitor.
    return NextResponse.json(
      { success: false, error: "Failed to record view." },
      { status: 502 }
    );
  }
}
