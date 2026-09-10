// -----------------------------------------------------------------------------
// Lead submission service
// -----------------------------------------------------------------------------
// This file is the single place that "sends" data collected from HAYVIA's forms
// (Get Matched, List Your Property, Property Inquiry, Contact).
//
// For this MVP, submissions are handled locally (logged + resolved) so the UI
// can be fully built and tested without a backend.
//
// When ready, swap the body of `submitLead` for a real integration, e.g.:
//   - Supabase / PostgreSQL: insert into a `leads` table
//   - CRM: POST to a CRM's REST API
//   - Email: send via a transactional email provider (Resend, Postmark, SES)
//   - Google Sheets: POST to a Google Apps Script web app / Sheets API
//   - Webhook: POST the payload to an internal automation (n8n, Zapier, Make)
//
// Every form in the app calls this same function, so only this file needs to
// change to go live with a real storage mechanism.
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
 * Currently a local mock handler — replace the implementation below to
 * connect to Supabase, a CRM, email, Google Sheets, or a webhook.
 */
export async function submitLead(lead: Lead): Promise<SubmitLeadResult> {
  // Simulate network latency so the UI's loading state can be exercised.
  await new Promise((resolve) => setTimeout(resolve, 700));

  // TODO(production): replace this block with a real integration call, e.g.
  //   await fetch("/api/leads", { method: "POST", body: JSON.stringify(lead) });
  // eslint-disable-next-line no-console
  console.info("[HAYVIA] New lead received:", lead);

  return {
    success: true,
    message: "Lead received.",
  };
}
