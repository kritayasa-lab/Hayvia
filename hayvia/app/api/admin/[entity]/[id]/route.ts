// -----------------------------------------------------------------------------
// PATCH /api/admin/[entity]/[id]
// -----------------------------------------------------------------------------
// Generic status-update endpoint for the admin CRM tables (Inquiries,
// Viewings, Seller Leads, Leads). `entity` is checked against the closed
// whitelist in lib/admin/status-config.ts before touching the database — the
// request body can never choose an arbitrary table or column. Every call
// re-verifies the caller is a signed-in ADMIN (getAdminUser(), the same
// server-side check every other /admin/* surface uses) before the
// service-role client ever runs.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { statusEntities } from "@/lib/admin/status-config";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { entity: string; id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 401 });
  }

  const config = statusEntities[params.entity];
  if (!config) {
    return NextResponse.json({ success: false, error: "Unknown entity." }, { status: 404 });
  }

  let payload: { status?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!payload.status || !config.options.includes(payload.status)) {
    return NextResponse.json({ success: false, error: "Invalid status value." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from(config.table)
    .update({ [config.column]: payload.status })
    .eq("id", params.id);

  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[Subphiphat Admin] Failed to update ${config.table}.${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: "Failed to update status." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
