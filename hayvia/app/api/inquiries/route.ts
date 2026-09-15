// -----------------------------------------------------------------------------
// POST /api/inquiries
// -----------------------------------------------------------------------------
// Real Supabase persistence for the property inquiry form (replaces the
// previous mock handler in lib/leads.ts). Runs entirely server-side using the
// service-role client (lib/supabase/admin.ts) — inquiries has RLS enabled
// with no anon/authenticated policy, by design, until Phase 11, so this is
// the only way a guest submission can be written today. Never claims success
// unless the insert actually succeeded.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPropertyToSupabase } from "@/lib/supabase/properties-sync";
import { getProperties, findPropertyBySlug } from "@/lib/properties-source";
import { getListingType } from "@/data/properties";

export const dynamic = "force-dynamic";

interface InquiryPayload {
  propertySlug?: string;
  propertyTitle?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  whatsapp?: string;
  additionalRequirements?: string;
}

export async function POST(request: Request) {
  let payload: InquiryPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const firstName = payload.firstName?.trim();
  const lastName = payload.lastName?.trim();
  const email = payload.email?.trim();
  const whatsapp = payload.whatsapp?.trim();
  const propertySlug = payload.propertySlug?.trim();

  if (!firstName || !lastName || !email || !whatsapp || !propertySlug) {
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

    // If this property came directly from Supabase (Phase A — the site's
    // primary source now), it already has a real row — resyncing it here
    // would be redundant at best, and for an admin-created property with no
    // external_ref, syncPropertyToSupabase's external_ref-based upsert
    // wouldn't find that row at all, creating a duplicate. Only Sheets/demo-
    // sourced properties (no supabaseId) still need the lazy sync.
    const propertyId = property.supabaseId ?? (await syncPropertyToSupabase(property));
    const supabase = createAdminClient();

    const { data: inquiry, error: inquiryError } = await supabase
      .from("inquiries")
      .insert({
        property_id: propertyId,
        name: `${firstName} ${lastName}`,
        email,
        phone: whatsapp,
        message: payload.additionalRequirements?.trim() || null,
        inquiry_type: "ENQUIRE",
        status: "NEW",
      })
      .select("id")
      .single();

    if (inquiryError || !inquiry) {
      throw new Error(inquiryError?.message ?? "Insert into inquiries returned no row.");
    }

    // Unified CRM layer — required by the leads table's own CHECK constraint
    // for source_type = INQUIRY (must carry inquiry_id). Best-effort: the
    // inquiry itself is already safely saved above regardless of whether
    // this secondary record succeeds.
    const { error: leadError } = await supabase.from("leads").insert({
      source_type: "INQUIRY",
      inquiry_id: inquiry.id,
      property_id: propertyId,
      customer_name: `${firstName} ${lastName}`,
      customer_email: email,
      customer_phone: whatsapp,
      lead_type: getListingType(property) === "sale" ? "BUY" : "RENT",
      status: "NEW",
    });
    if (leadError) {
      // eslint-disable-next-line no-console
      console.error("[Subphiphat] Inquiry saved, but creating its CRM lead row failed:", leadError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to save inquiry to Supabase:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 502 }
    );
  }
}
