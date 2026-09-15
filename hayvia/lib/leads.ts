// -----------------------------------------------------------------------------
// Lead submission service
// -----------------------------------------------------------------------------
// This file is the single place that "sends" data collected from Subphiphat
// Real Estate's forms (Property Inquiry, Property Viewing, List Your
// Property, Contact).
//
// Property Inquiry and Property Viewing are real Supabase-backed writes —
// see app/api/inquiries/route.ts and app/api/viewings/route.ts (server-side,
// service-role client; inquiries/viewings have RLS enabled with no
// anon/authenticated policy, so this is the only path that can write them
// today).
//
// Get Matched no longer goes through this file — the matching flow (real
// deterministic scoring + its own Supabase writes) lives at /api/match and
// is called directly by components/matching/MatchingWizard.tsx, since it
// returns structured results, not a simple accept/reject lead submission.
//
// List Your Property and Contact still use a local mock handler — out of
// this pass's scope (see supabase/DATABASE_SCHEMA.md: seller_leads already
// has a real schema for List Your Property, but wiring it up is left for a
// following pass). When ready, swap their block below for a real
// integration the same way Inquiry/Viewing were.
//
// Every form in the app calls the same `submitLead` function, so this file
// is the only place that needs to change to go live with a new integration.
// -----------------------------------------------------------------------------

export type LeadSource = "property-inquiry" | "property-viewing" | "list-your-property" | "contact";

export interface BaseLead {
  source: LeadSource;
  submittedAt: string;
}

export interface PropertyInquiryLead extends BaseLead {
  source: "property-inquiry";
  propertySlug: string;
  propertyTitle: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  additionalRequirements?: string;
}

export interface PropertyViewingLead extends BaseLead {
  source: "property-viewing";
  propertySlug: string;
  propertyTitle: string;
  // The public viewing flow is in-person only — see components/property/ViewingForm.tsx.
  viewingType: "In-person Viewing";
  preferredDate: string;
  preferredTime: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  message?: string;
}

export interface ListPropertyLead extends BaseLead {
  source: "list-your-property";
  name: string;
  company?: string;
  phone: string;
  email: string;
  propertyName: string;
  propertyType: string;
  location: string;
  monthlyRent: string;
  availableDate: string;
  description: string;
  contactMethod: string;
}

export interface ContactLead extends BaseLead {
  source: "contact";
  name: string;
  email: string;
  message: string;
}

export type Lead = PropertyInquiryLead | PropertyViewingLead | ListPropertyLead | ContactLead;

export interface SubmitLeadResult {
  success: boolean;
  message: string;
}

/**
 * Submits a lead captured from any form on the site.
 *
 * - "property-inquiry" → real Supabase insert via /api/inquiries.
 * - "property-viewing" → real Supabase insert via /api/viewings.
 * - "list-your-property" / "contact" → still a local mock handler; replace
 *   their branch below to go live with a real integration.
 */
export async function submitLead(lead: Lead): Promise<SubmitLeadResult> {
  if (lead.source === "property-inquiry") {
    return submitToRoute("/api/inquiries", lead);
  }

  if (lead.source === "property-viewing") {
    return submitToRoute("/api/viewings", lead);
  }

  // Mock handler for List Your Property and Contact.
  // Simulate network latency so the UI's loading state can be exercised.
  await new Promise((resolve) => setTimeout(resolve, 700));

  // TODO(production): replace this block with a real integration call, e.g.
  //   await fetch("/api/leads", { method: "POST", body: JSON.stringify(lead) });
  // eslint-disable-next-line no-console
  console.info("[Subphiphat] New lead received:", lead);

  return {
    success: true,
    message: "Lead received.",
  };
}

/**
 * POSTs a lead to one of our own Route Handlers (/api/inquiries,
 * /api/viewings), which perform the real, server-side Supabase insert.
 * Never reports success unless that insert actually succeeded — a failed
 * fetch, a non-2xx response, or `{ success: false }` in the body all become
 * an honest failure result the calling form can show to the user.
 */
async function submitToRoute(path: string, lead: Lead): Promise<SubmitLeadResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });

    let data: { success?: boolean; error?: string } | null = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.ok && data?.success) {
      return { success: true, message: "Lead received." };
    }

    return {
      success: false,
      message: data?.error || "Something went wrong. Please try again.",
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Subphiphat] Failed to reach ${path}:`, error);
    return {
      success: false,
      message: "Something went wrong. Please check your connection and try again.",
    };
  }
}
