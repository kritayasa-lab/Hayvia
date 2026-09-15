// -----------------------------------------------------------------------------
// POST /api/viewings
// -----------------------------------------------------------------------------
// Real Supabase persistence for the property viewing-request form. Same
// pattern as /api/inquiries — service-role client, server-only, never claims
// success unless the insert actually succeeded. Writes `viewing_type` (added
// in supabase/migrations/20260912100013_pass2_viewing_type_and_min_size.sql —
// see that file's header for why it was needed and the manual step required
// to apply it).
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPropertyToSupabase } from "@/lib/supabase/properties-sync";
import { getProperties, findPropertyBySlug } from "@/lib/properties-source";

export const dynamic = "force-dynamic";

interface ViewingPayload {
  propertySlug?: string;
  propertyTitle?: string;
  viewingType?: "In-person Viewing" | "Video Call";
  preferredDate?: string;
  preferredTime?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  message?: string;
}

export async function POST(request: Request) {
  let payload: ViewingPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const firstName = payload.firstName?.trim();
  const lastName = payload.lastName?.trim();
  const phone = payload.phone?.trim();
  const email = payload.email?.trim();
  const propertySlug = payload.propertySlug?.trim();
  const preferredDate = payload.preferredDate?.trim();
  const preferredTime = payload.preferredTime?.trim();

  if (!firstName || !lastName || !phone || !email || !propertySlug || !preferredDate || !preferredTime) {
    return NextResponse.json(
      { success: false, error: "Missing required fields." },
      { status: 400 }
    );
  }

  try {
    const { properties } = await getProperties();
    const property = findPropertyBySlug(properties, propertySlug);
    if (!property) {
      return NextResponse.json(
        { success: false, error: "That property could not be found." },
        { status: 404 }
      );
    }

    const propertyId = await syncPropertyToSupabase(property);
    const supabase = createAdminClient();

    const { error } = await supabase.from("viewings").insert({
      property_id: propertyId,
      viewing_type: payload.viewingType === "Video Call" ? "VIDEO_CALL" : "IN_PERSON",
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      customer_name: `${firstName} ${lastName}`,
      customer_phone: phone,
      customer_email: email,
      notes: payload.message?.trim() || null,
      status: "REQUESTED",
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to save viewing request to Supabase:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 502 }
    );
  }
}
