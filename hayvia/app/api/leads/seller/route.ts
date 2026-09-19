// -----------------------------------------------------------------------------
// POST /api/leads/seller
// -----------------------------------------------------------------------------
// Real Supabase persistence for the "List Your Property" (Sell Your Property)
// form — replaces the previous mock handler in lib/leads.ts. Runs entirely
// server-side using the service-role client (lib/supabase/admin.ts), the same
// pattern app/api/inquiries/route.ts and app/api/viewings/route.ts already
// use: seller_leads has RLS enabled with no anon/authenticated policy, so
// this is the only way a guest submission can be written. Never claims
// success unless the insert actually succeeded.
//
// Every field written to `seller_leads` is built explicitly from validated,
// server-parsed values below — the client payload is never spread directly
// into the insert, so there is no way for a request body to set status,
// assigned_staff, notes, customer_id, created_at/updated_at, or anything
// else not explicitly listed here. status is always "NEW".
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateCustomer } from "@/lib/customers/identity";

export const dynamic = "force-dynamic";

const PROPERTY_TYPE_MAP: Record<string, string> = {
  Condo: "CONDO",
  Apartment: "APARTMENT",
  House: "HOUSE",
  Townhouse: "TOWNHOUSE",
};

const CONTACT_METHODS = new Set(["PHONE", "LINE", "WHATSAPP", "EMAIL"]);

interface SellerLeadPayload {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  propertyName?: string;
  propertyType?: string;
  district?: string;
  expectedPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
  sizeSqm?: string;
  availableDate?: string;
  description?: string;
  preferredContactMethod?: string;
  lineId?: string;
  whatsappNumber?: string;
}

function toNullableNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  let payload: SellerLeadPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const name = payload.name?.trim();
  const email = payload.email?.trim();
  const phone = payload.phone?.trim();
  const propertyType = payload.propertyType?.trim();
  const district = payload.district?.trim();
  const description = payload.description?.trim();
  const contactMethod = payload.preferredContactMethod?.trim().toUpperCase();
  const lineId = payload.lineId?.trim();
  const whatsappNumber = payload.whatsappNumber?.trim();

  if (!name || !email || !phone || !propertyType || !district || !description) {
    return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
  }
  if (!email.includes("@")) {
    return NextResponse.json({ success: false, error: "Please enter a valid email." }, { status: 400 });
  }
  if (!contactMethod || !CONTACT_METHODS.has(contactMethod)) {
    return NextResponse.json(
      { success: false, error: "Please choose a preferred contact method." },
      { status: 400 }
    );
  }
  if (contactMethod === "LINE" && !lineId) {
    return NextResponse.json({ success: false, error: "Please enter your LINE ID." }, { status: 400 });
  }
  if (contactMethod === "WHATSAPP" && !whatsappNumber) {
    return NextResponse.json({ success: false, error: "Please enter your WhatsApp number." }, { status: 400 });
  }

  const mappedPropertyType = PROPERTY_TYPE_MAP[propertyType] ?? null;

  // seller_leads has no property-name/company/available-date columns of its
  // own — folded into the two free-text columns that already exist rather
  // than adding more, matching how matching_preferences folds multi-select
  // "Preferred Areas" into a single text column elsewhere in this codebase.
  const fullDescription = [payload.propertyName?.trim() && `Property: ${payload.propertyName.trim()}`, description]
    .filter(Boolean)
    .join("\n\n");
  const additionalInfo =
    [
      payload.company?.trim() && `Company/Agency: ${payload.company.trim()}`,
      payload.availableDate?.trim() && `Available from: ${payload.availableDate.trim()}`,
    ]
      .filter(Boolean)
      .join("\n") || null;

  try {
    const supabase = createAdminClient();

    // Customer identity resolution — best-effort, never blocks or fails the
    // submission itself, same posture as app/api/inquiries/route.ts.
    let customerId: string | null = null;
    try {
      const customerResult = await findOrCreateCustomer({
        fullName: name,
        email,
        phone,
        firstSeenSource: "SELLER_LEAD",
      });
      if (customerResult.status === "conflict") {
        // eslint-disable-next-line no-console
        console.error(
          `[Subphiphat] Customer identity conflict on seller lead submission (email -> customer ${customerResult.emailCustomerId}, phone -> customer ${customerResult.phoneCustomerId}) — leaving customer_id unset for manual review.`
        );
      } else {
        customerId = customerResult.customerId;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Subphiphat] Customer identity resolution failed for seller lead:", err);
    }

    const { data: sellerLead, error: sellerLeadError } = await supabase
      .from("seller_leads")
      .insert({
        full_name: name,
        email,
        phone,
        property_type: mappedPropertyType,
        province: "Songkhla",
        city: "Hat Yai",
        district,
        expected_price: toNullableNumber(payload.expectedPrice),
        bedrooms: toNullableNumber(payload.bedrooms),
        bathrooms: toNullableNumber(payload.bathrooms),
        size_sqm: toNullableNumber(payload.sizeSqm),
        description: fullDescription,
        additional_info: additionalInfo,
        preferred_contact_method: contactMethod,
        line_id: contactMethod === "LINE" ? lineId : null,
        whatsapp_number: contactMethod === "WHATSAPP" ? whatsappNumber : null,
        status: "NEW",
        customer_id: customerId,
      })
      .select("id")
      .single();

    if (sellerLeadError || !sellerLead) {
      throw new Error(sellerLeadError?.message ?? "Insert into seller_leads returned no row.");
    }

    // Unified CRM layer — same best-effort secondary record every other
    // guest submission path (inquiries, viewings, matching) already creates.
    const { error: leadError } = await supabase.from("leads").insert({
      source_type: "SELLER_LEAD",
      seller_lead_id: sellerLead.id,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      lead_type: "SELL",
      status: "NEW",
      customer_id: customerId,
    });
    if (leadError) {
      // eslint-disable-next-line no-console
      console.error("[Subphiphat] Seller lead saved, but creating its CRM lead row failed:", leadError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to save seller lead to Supabase:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 502 }
    );
  }
}
