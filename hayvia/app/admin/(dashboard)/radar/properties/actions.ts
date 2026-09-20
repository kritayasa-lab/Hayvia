"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateManualSource } from "@/lib/radar/sources";
import { findPossibleDuplicateCandidates, type PossibleDuplicateCandidate } from "@/lib/radar/dedup";
import { runPropertyAiAnalysis } from "@/lib/radar/ai-analysis";

export interface RadarCandidateActionState {
  error?: string;
  duplicates?: PossibleDuplicateCandidate[];
  rawId?: string;
}

function requireString(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

function optionalString(formData: FormData, key: string): string | null {
  const value = requireString(formData, key);
  return value || null;
}

function optionalNumber(formData: FormData, key: string): number | null {
  const value = requireString(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Manual Property Radar intake. Never spreads formData/request bodies into
 * an insert — every field written is explicitly named below.
 *
 * Two-step by design: a first submission creates the raw evidence record
 * and, if a rule-based duplicate is found, returns it to the UI instead of
 * silently creating a second candidate (see lib/radar/dedup.ts). The form
 * re-submits with the same `raw_id` (so evidence is never duplicated) and
 * `force_create=1` (the "Create Anyway" button) to proceed past the
 * duplicate warning — an explicit human decision, never automatic.
 */
export async function createManualCandidate(
  _prevState: RadarCandidateActionState | null,
  formData: FormData
): Promise<RadarCandidateActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const propertyType = requireString(formData, "property_type");
  const city = requireString(formData, "city");
  const description = requireString(formData, "description");
  if (!propertyType) return { error: "Please choose a property type." };
  if (!city) return { error: "Please enter a city." };
  if (!description) return { error: "Please enter a description." };

  const sourceUrl = optionalString(formData, "source_url");
  const sourceIdentifier = optionalString(formData, "source_identifier");
  const province = optionalString(formData, "province") ?? "Songkhla";
  const district = optionalString(formData, "district");
  const price = optionalNumber(formData, "price");
  const bedrooms = optionalNumber(formData, "bedrooms");
  const bathrooms = optionalNumber(formData, "bathrooms");
  const sizeSqm = optionalNumber(formData, "size_sqm");
  const evidenceNotes = optionalString(formData, "evidence_notes");
  const forceCreate = formData.get("force_create") === "1";

  const supabase = createAdminClient();

  let sourceId: string;
  try {
    sourceId = await findOrCreateManualSource(supabase);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to resolve the Manual Entry source." };
  }

  let rawId = optionalString(formData, "raw_id");
  if (!rawId) {
    const { data: raw, error: rawError } = await supabase
      .from("radar_property_raw")
      .insert({
        source_id: sourceId,
        source_url: sourceUrl,
        source_identifier: sourceIdentifier,
        // Preserves exactly what was submitted, including the free-text
        // evidence notes — the normalized candidate row below is built from
        // the same values, but this is the untouched evidence record.
        raw_payload: {
          propertyType,
          province,
          city,
          district,
          price,
          bedrooms,
          bathrooms,
          sizeSqm,
          description,
          evidenceNotes,
          submittedBy: admin.id,
        },
      })
      .select("id")
      .single();

    if (rawError || !raw) {
      return { error: rawError?.message || "Failed to save the raw record." };
    }
    rawId = raw.id as string;
  }

  if (!forceCreate) {
    const duplicates = await findPossibleDuplicateCandidates(supabase, {
      district,
      propertyType,
      bedrooms,
      price,
    });
    if (duplicates.length > 0) {
      return { duplicates, rawId };
    }
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("radar_property_candidates")
    .insert({
      raw_id: rawId,
      source_id: sourceId,
      source_url: sourceUrl,
      source_identifier: sourceIdentifier,
      property_type: propertyType,
      province,
      city,
      district,
      price,
      bedrooms,
      bathrooms,
      size_sqm: sizeSqm,
      description,
      status: "DISCOVERED",
    })
    .select("id")
    .single();

  if (candidateError || !candidate) {
    return { error: candidateError?.message || "Failed to create the Radar candidate." };
  }

  const { error: historyError } = await supabase.from("radar_property_status_history").insert({
    candidate_id: candidate.id,
    from_status: null,
    to_status: "DISCOVERED",
    changed_by: admin.id,
  });
  if (historyError) {
    // eslint-disable-next-line no-console
    console.error(
      `[Subphiphat Admin] Radar candidate ${candidate.id} created, but its initial status history row failed:`,
      historyError
    );
  }

  // A new row changes what the list and overview pages show — revalidate
  // both so a browser tab already sitting on either doesn't keep serving a
  // stale (pre-creation) Router Cache entry on its next visit. The new
  // candidate's own detail page needs no revalidation: it didn't exist
  // before, so redirect() below renders it fresh with nothing stale to beat.
  revalidatePath("/admin/radar/properties");
  revalidatePath("/admin/radar");

  redirect(`/admin/radar/properties/${candidate.id}?created=1`);
}

/**
 * Explicit human confirmation that `candidateId` duplicates an existing
 * candidate, identified by its human-readable code (friendlier to type than
 * a UUID). Never deletes either candidate — only links and closes the one
 * being marked.
 */
export async function markDuplicate(candidateId: string, formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const duplicateOfCode = requireString(formData, "duplicate_of_code");
  if (!duplicateOfCode) {
    redirect(`/admin/radar/properties/${candidateId}?dupError=missing`);
  }

  const supabase = createAdminClient();

  const [{ data: candidate }, { data: target }] = await Promise.all([
    supabase.from("radar_property_candidates").select("id, status").eq("id", candidateId).maybeSingle(),
    supabase
      .from("radar_property_candidates")
      .select("id, candidate_code")
      .ilike("candidate_code", duplicateOfCode)
      .maybeSingle(),
  ]);

  if (!candidate) redirect("/admin/radar/properties");
  if (!target) redirect(`/admin/radar/properties/${candidateId}?dupError=notfound`);
  if (target.id === candidateId) redirect(`/admin/radar/properties/${candidateId}?dupError=self`);

  const { error } = await supabase
    .from("radar_property_candidates")
    .update({
      status: "DUPLICATE",
      duplicate_of_candidate_id: target.id,
      duplicate_confidence: 100,
    })
    .eq("id", candidateId);

  if (!error) {
    await supabase.from("radar_property_status_history").insert({
      candidate_id: candidateId,
      from_status: candidate.status,
      to_status: "DUPLICATE",
      changed_by: admin.id,
      note: `Marked duplicate of ${target.candidate_code}`,
    });

    // Revalidate every route whose rendered data depends on this status
    // change — the redirect below already forces a fresh render of this
    // candidate's own page, but the list/overview pages (and any other tab
    // already sitting on this exact candidate page) would otherwise keep
    // serving the pre-DUPLICATE Router Cache entry until it expires.
    revalidatePath(`/admin/radar/properties/${candidateId}`);
    revalidatePath("/admin/radar/properties");
    revalidatePath("/admin/radar");
  }

  redirect(`/admin/radar/properties/${candidateId}`);
}

/**
 * Runs (or, in this phase, attempts to run) AI analysis for a candidate.
 * Never inserts a radar_property_analysis row unless
 * runPropertyAiAnalysis() reports `configured: true` — see
 * lib/radar/ai-analysis.ts, which always returns `configured: false` until
 * a real provider is wired up. The insert/status-transition path below is
 * unreachable today but is written correctly for when one is.
 */
export async function runAiAnalysisAction(candidateId: string) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  const { data: candidate } = await supabase
    .from("radar_property_candidates")
    .select(
      "id, status, raw_id, property_type, province, city, district, price, bedrooms, bathrooms, size_sqm, description"
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate) redirect("/admin/radar/properties");

  let rawPayload: unknown = null;
  if (candidate.raw_id) {
    const { data: raw } = await supabase
      .from("radar_property_raw")
      .select("raw_payload")
      .eq("id", candidate.raw_id)
      .maybeSingle();
    rawPayload = raw?.raw_payload ?? null;
  }

  const result = await runPropertyAiAnalysis({
    candidateId,
    facts: {
      propertyType: candidate.property_type,
      province: candidate.province,
      city: candidate.city,
      district: candidate.district,
      price: candidate.price,
      bedrooms: candidate.bedrooms,
      bathrooms: candidate.bathrooms,
      sizeSqm: candidate.size_sqm,
      description: candidate.description,
    },
    rawPayload,
  });

  if (!result.configured) {
    redirect(`/admin/radar/properties/${candidateId}?aiStatus=not_configured`);
  }

  const { count } = await supabase
    .from("radar_property_analysis")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", candidateId);
  const nextVersion = (count ?? 0) + 1;

  const { error: analysisError } = await supabase.from("radar_property_analysis").insert({
    candidate_id: candidateId,
    version: nextVersion,
    model_name: result.modelName ?? null,
    model_version: result.modelVersion ?? null,
    facts: result.facts ?? {},
    ai_inference: result.aiInference ?? {},
    unknowns: result.unknowns ?? [],
    confidence: result.confidence ?? null,
    evidence: result.evidence ?? {},
  });

  if (!analysisError && candidate.status === "DISCOVERED") {
    await supabase.from("radar_property_candidates").update({ status: "AI_REVIEWED" }).eq("id", candidateId);
    await supabase.from("radar_property_status_history").insert({
      candidate_id: candidateId,
      from_status: "DISCOVERED",
      to_status: "AI_REVIEWED",
      changed_by: admin.id,
      note: "AI analysis completed",
    });
  }

  redirect(`/admin/radar/properties/${candidateId}?aiStatus=analyzed`);
}
