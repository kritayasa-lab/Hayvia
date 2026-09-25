"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyLeadCandidate } from "@/lib/radar/lead-intelligence";

// -----------------------------------------------------------------------------
// PR #25 — detail page action. Re-runs classification for one existing
// candidate (a fresh version, not a new candidate) — the same
// classifyLeadCandidate() core the import flow's batch action and the
// manual test page both use. No new logic here.
// -----------------------------------------------------------------------------

export async function runLeadIntelligenceAction(candidateId: string) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  const outcome = await classifyLeadCandidate(supabase, candidateId, admin.id);

  if (!outcome.ok) {
    // eslint-disable-next-line no-console
    console.error(`[Subphiphat Admin] Run Lead Intelligence failed for candidate ${candidateId}:`, outcome.error);
    revalidatePath(`/admin/radar/leads/${candidateId}`);
    redirect(`/admin/radar/leads/${candidateId}?classifyError=${encodeURIComponent(outcome.error)}`);
  }

  revalidatePath(`/admin/radar/leads/${candidateId}`);
  revalidatePath("/admin/radar/leads");
  revalidatePath("/admin/radar");
  redirect(`/admin/radar/leads/${candidateId}?classified=1`);
}
