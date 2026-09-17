"use server";

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Adds one timestamped staff note to a lead (lead_notes — Phase 1 CRM).
 * Plain form action, same pattern as addPropertyImage in
 * app/admin/(dashboard)/properties/actions.ts: no rich error state, just a
 * silent no-op redirect if the note is empty.
 */
export async function addLeadNote(leadId: string, formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const note = String(formData.get("note") || "").trim();
  if (!note) redirect(`/admin/leads/${leadId}`);

  const supabase = createAdminClient();
  await supabase.from("lead_notes").insert({
    lead_id: leadId,
    author_id: admin.id,
    note,
  });

  redirect(`/admin/leads/${leadId}`);
}
