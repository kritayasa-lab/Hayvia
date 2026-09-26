import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// -----------------------------------------------------------------------------
// PR #25 — Lead Radar admin data layer. Mirrors lib/admin/radar-properties.ts's
// exact shape/conventions, applied to the Lead Radar domain, which had no
// list/detail admin pages at all before this PR (only the PR #23/#24 test
// pages).
//
// lead_category is read directly off radar_lead_candidates (denormalized,
// PR #25's own migration) for fast list filtering. Lead quality/confidence
// are NOT denormalized — radar_lead_analysis remains their one source of
// truth, so the list query joins the latest analysis row per candidate
// rather than adding more mirror columns (see fetchRadarLeadCandidates()).
// -----------------------------------------------------------------------------

export interface RadarLeadListRow {
  id: string;
  candidate_code: string;
  status: string;
  lead_category: string | null;
  poster_role: string | null;
  qualification: string | null;
  source_type: string | null;
  source_name: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  property_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  bedrooms: number | null;
  discovered_at: string;
  last_seen_at: string;
  /** From the latest radar_lead_analysis row — source of truth, not a candidate column. */
  leadQuality: string | null;
  confidence: number | null;
}

/**
 * Mirrors lib/admin/properties.ts's / lib/admin/radar-properties.ts's
 * search-priority shape: exact candidate_code (case-insensitive) > exact
 * UUID > free-text fallback on notes_from_source/city/district.
 */
export async function fetchRadarLeadCandidates(filters: {
  status?: string;
  leadCategory?: string;
  q?: string;
}): Promise<RadarLeadListRow[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("radar_lead_candidates")
    .select(
      "id, candidate_code, status, lead_category, poster_role, qualification, province, city, district, property_type, budget_min, budget_max, bedrooms, discovered_at, last_seen_at, radar_sources(source_type, name)"
    )
    .order("discovered_at", { ascending: false })
    .limit(200);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.leadCategory) {
    query = query.eq("lead_category", filters.leadCategory);
  }
  if (filters.q) {
    const term = filters.q.trim();
    if (term) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(term);
      const isCandidateCode = /^RADAR-L-\d{6,}$/i.test(term);
      if (isCandidateCode) {
        query = query.ilike("candidate_code", term);
      } else if (isUuid) {
        query = query.eq("id", term);
      } else {
        query = query.or(`notes_from_source.ilike.%${term}%,city.ilike.%${term}%,district.ilike.%${term}%`);
      }
    }
  }

  const { data, error } = await query;
  if (error || !data) {
    // eslint-disable-next-line no-console
    if (error) console.error("[Subphiphat Admin] Failed to load Radar Lead candidates:", error);
    return [];
  }

  const ids = data.map((row) => row.id as string);
  const latestAnalysisByCandidate = await fetchLatestAnalysisMap(supabase, ids);

  return data.map((row) => {
    const source = row.radar_sources as unknown as { source_type?: string; name?: string } | null;
    const latest = latestAnalysisByCandidate.get(row.id as string);
    return {
      id: row.id as string,
      candidate_code: row.candidate_code as string,
      status: row.status as string,
      lead_category: row.lead_category as string | null,
      poster_role: row.poster_role as string | null,
      qualification: row.qualification as string | null,
      source_type: source?.source_type ?? null,
      source_name: source?.name ?? null,
      province: row.province as string | null,
      city: row.city as string | null,
      district: row.district as string | null,
      property_type: row.property_type as string | null,
      budget_min: row.budget_min as number | null,
      budget_max: row.budget_max as number | null,
      bedrooms: row.bedrooms as number | null,
      discovered_at: row.discovered_at as string,
      last_seen_at: row.last_seen_at as string,
      leadQuality: latest?.intent_category ?? null,
      confidence: latest?.confidence ?? null,
    };
  });
}

// Supabase-js has no built-in "latest row per group" query, so this reads
// every analysis row for the candidates on the current page (bounded by
// the same 200-row list cap) and reduces to the highest version per
// candidate_id in JS — same "map/reduce client-side over a bounded read"
// pattern already used elsewhere in this admin layer (e.g. status counts
// in lib/admin/radar.ts), not a raw SQL DISTINCT ON.
async function fetchLatestAnalysisMap(
  supabase: ReturnType<typeof createAdminClient>,
  candidateIds: string[]
): Promise<Map<string, { intent_category: string | null; confidence: number | null }>> {
  const map = new Map<string, { intent_category: string | null; confidence: number | null }>();
  if (candidateIds.length === 0) return map;

  const { data } = await supabase
    .from("radar_lead_analysis")
    .select("candidate_id, version, intent_category, confidence")
    .in("candidate_id", candidateIds)
    .order("version", { ascending: false });

  for (const row of data ?? []) {
    const candidateId = row.candidate_id as string;
    if (!map.has(candidateId)) {
      map.set(candidateId, {
        intent_category: row.intent_category as string | null,
        confidence: row.confidence as number | null,
      });
    }
  }
  return map;
}

export interface RadarLeadAnalysisRow {
  id: string;
  version: number;
  model_name: string | null;
  model_version: string | null;
  facts: Record<string, unknown>;
  ai_inference: Record<string, unknown>;
  unknowns: unknown[];
  intent_category: string | null;
  intent_score: number | null;
  confidence: number | null;
  evidence: Record<string, unknown>;
  human_override: Record<string, unknown> | null;
  created_at: string;
}

function mapAnalysisRow(row: Record<string, unknown>): RadarLeadAnalysisRow {
  return {
    id: row.id as string,
    version: row.version as number,
    model_name: row.model_name as string | null,
    model_version: row.model_version as string | null,
    facts: (row.facts ?? {}) as Record<string, unknown>,
    ai_inference: (row.ai_inference ?? {}) as Record<string, unknown>,
    unknowns: (row.unknowns ?? []) as unknown[],
    intent_category: row.intent_category as string | null,
    intent_score: row.intent_score as number | null,
    confidence: row.confidence as number | null,
    evidence: (row.evidence ?? {}) as Record<string, unknown>,
    human_override: row.human_override as Record<string, unknown> | null,
    created_at: row.created_at as string,
  };
}

export interface RadarLeadStatusHistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by_name: string | null;
  note: string | null;
}

export interface RadarLeadCandidateDetail {
  candidate: Record<string, unknown> & {
    id: string;
    candidate_code: string;
    status: string;
    raw_id: string | null;
    lead_category: string | null;
  };
  source: { source_type: string; name: string; source_url: string | null } | null;
  raw: { raw_payload: unknown; content_fingerprint: string | null } | null;
  analyses: RadarLeadAnalysisRow[];
  history: RadarLeadStatusHistoryRow[];
}

export async function fetchRadarLeadCandidateDetail(id: string): Promise<RadarLeadCandidateDetail | null> {
  const supabase = createAdminClient();

  const { data: candidate } = await supabase
    .from("radar_lead_candidates")
    .select("*, radar_sources(source_type, name, source_url)")
    .eq("id", id)
    .maybeSingle();

  if (!candidate) return null;

  const [{ data: raw }, { data: analyses }, { data: history }] = await Promise.all([
    candidate.raw_id
      ? supabase.from("radar_lead_raw").select("raw_payload, content_fingerprint").eq("id", candidate.raw_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("radar_lead_analysis").select("*").eq("candidate_id", id).order("version", { ascending: false }),
    supabase
      .from("radar_lead_status_history")
      .select("id, from_status, to_status, changed_at, note, profiles(full_name)")
      .eq("candidate_id", id)
      .order("changed_at", { ascending: false }),
  ]);

  const source = candidate.radar_sources as unknown as
    | { source_type: string; name: string; source_url: string | null }
    | null;

  return {
    candidate,
    source,
    raw: raw ?? null,
    analyses: (analyses ?? []).map(mapAnalysisRow),
    history: (history ?? []).map((row) => ({
      id: row.id as string,
      from_status: row.from_status as string | null,
      to_status: row.to_status as string,
      changed_at: row.changed_at as string,
      changed_by_name: (row.profiles as unknown as { full_name?: string } | null)?.full_name ?? null,
      note: row.note as string | null,
    })),
  };
}
