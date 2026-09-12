// -----------------------------------------------------------------------------
// Lead submission service
// -----------------------------------------------------------------------------
// This file is the single place that "sends" data collected from Subphiphat Real Estate's forms
// (Get Matched, List Your Property, Property Inquiry, Contact).
//
// Get Matched submissions are POSTed to /api/get-matched (a Next.js Route
// Handler), which forwards them server-side to the Google Apps Script Web App
// configured in config/integrations.ts and relays back a real, parsed result.
// The browser never talks to Google Apps Script directly — see
// app/api/get-matched/route.ts for that server-side step.
//
// The other forms (Property Inquiry, List Your Property, Contact) still use a
// local mock handler for now, so the UI can be tested without a backend. When
// ready, swap their block below for a real integration, e.g.:
//   - Supabase / PostgreSQL: insert into a `leads` table
//   - CRM: POST to a CRM's REST API
//   - Email: send via a transactional email provider (Resend, Postmark, SES)
//   - Google Sheets: POST to a Google Apps Script web app / Sheets API
//   - Webhook: POST the payload to an internal automation (n8n, Zapier, Make)
//
// Every form in the app calls the same `submitLead` function, so this file is
// the only place that needs to change to go live with a new integration.
// -----------------------------------------------------------------------------

export type LeadSource =
  | "get-matched"
  | "property-inquiry"
  | "list-your-property"
  | "contact";

export interface BaseLead {
  source: LeadSource;
  submittedAt: string;
}

export interface GetMatchedLead extends BaseLead {
  source: "get-matched";
  name: string;
  nationality: string;
  contactMethod: string;
  contactInfo: string;
  propertyType: string;
  preferredArea: string;
  budget: string;
  bedrooms: string;
  furnished: string;
  parking: string;
  moveInDate: string;
  rentalDuration: string;
  occupants: string;
  additionalRequirements?: string;
}

export interface PropertyInquiryLead extends BaseLead {
  source: "property-inquiry";
  propertySlug: string;
  propertyTitle: string;
  name: string;
  email: string;
  whatsapp: string;
  moveInDate: string;
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

export type Lead =
  | GetMatchedLead
  | PropertyInquiryLead
  | ListPropertyLead
  | ContactLead;

export interface SubmitLeadResult {
  success: boolean;
  message: string;
}

/**
 * Submits a lead captured from any form on the site.
 *
 * - "get-matched" leads are sent live to the Google Apps Script Web App.
 * - All other lead types currently use a local mock handler — replace their
 *   branch below to connect to Supabase, a CRM, email, Google Sheets, or a
 *   webhook.
 */
export async function submitLead(lead: Lead): Promise<SubmitLeadResult> {
  if (lead.source === "get-matched") {
    return submitGetMatchedLead(lead);
  }

  // Mock handler for Property Inquiry, List Your Property, and Contact.
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
 * Sends a Get Matched submission to our own /api/get-matched Route Handler,
 * which forwards it server-side to the Google Apps Script Web App configured
 * in config/integrations.ts. The browser only ever talks to /api/get-matched
 * — see app/api/get-matched/route.ts for the server-side forwarding step and
 * the real success/failure result parsed from Apps Script's response.
 */
async function submitGetMatchedLead(lead: GetMatchedLead): Promise<SubmitLeadResult> {
  try {
    const response = await fetch("/api/get-matched", {
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
      return {
        success: true,
        message: "Lead received.",
      };
    }

    return {
      success: false,
      message: data?.error || "Failed to submit lead.",
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Failed to reach /api/get-matched:", error);
    return {
      success: false,
      message:
        "Something went wrong sending your details. Please check your connection and try again.",
    };
  }
}

