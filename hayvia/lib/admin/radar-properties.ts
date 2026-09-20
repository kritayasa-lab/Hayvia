import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RadarPropertyListRow {
  id: string;
  candidate_code: string;
  status: string;
  source_type: string | null;
  source_name: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  property_type: string | null;
  price: number | null;
  bedrooms: number | null;
  discovered_at: string;
  last_seen_at: string;
}

/**
 * Mirrors lib/admin/properties.ts's fetchAdminProperties search-priority
 * shape: exact candidate_code (case-insensitive) > exact UUID > free-text
 * fallback on description/city/district. Never duplicated logic — same
 * pattern, applied to the new table.
 */
export async function fetchRadarPropertyCandidates(filters: {
  status?: string;
  q?: string;
}): Promise<RadarPropertyListRow[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("radar_property_candidates")
    .select(
      "id, candidate_code, status, province, city, district, property_type, price, bedrooms, discovered_at, last_seen_at, radar_sources(source_type, name)"
    )
    .order("discovered_at", { ascending: false })
    .limit(200);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.q) {
    const term = filters.q.trim();
    if (term) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(term);
      const isCandidateCode = /^RADAR-P-\d{6,}$/i.test(term);
      if (isCandidateCode) {
        query = query.ilike("candidate_code", term);
      } else if (isUuid) {
        query = query.eq("id", term);
      } else {
        query = query.or(`description.ilike.%${term}%,city.ilike.%${term}%,district.ilike.%${term}%`);
      }
    }
  }

  const { data, error } = await query;
  if (error || !data) {
    // eslint-disable-next-line no-console
    if (error) console.error("[Subphiphat Admin] Failed to load Radar property candidates:", error);
    return [];
  }

  return data.map((row) => {
    const source = row.radar_sources as unknown as { source_type?: string; name?: string } | null;
    return {
      id: row.id as string,
      candidate_code: row.candidate_code as string,
      status: row.status as string,
      source_type: source?.source_type ?? null,
      source_name: source?.name ?? null,
      province: row.province as string | null,
      city: row.city as string | null,
      district: row.district as string | null,
      property_type: row.property_type as string | null,
      price: row.price as number | null,
      bedrooms: row.bedrooms as number | null,
      discovered_at: row.discovered_at as string,
      last_seen_at: row.last_seen_at as string,
    };
  });
}

export interface RadarPropertyAnalysisRow {
  id: string;
  version: number;
  model_name: string | null;
  model_version: string | null;
  facts: Record<string, unknown>;
  ai_inference: Record<string, unknown>;
  unknowns: unknown[];
  confidence: number | null;
  evidence: Record<string, unknown>;
  human_override: Record<string, unknown> | null;
  created_at: string;
}

export interface RadarPropertyStatusHistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by_name: string | null;
  note: string | null;
}

export interface RadarPropertyCandidateDetail {
  candidate: Record<string, unknown> & {
    id: string;
    candidate_code: string;
    status: string;
    raw_id: string | null;
  };
  source: { source_type: string; name: string; source_url: string | null } | null;
  raw: { raw_payload: unknown; content_fingerprint: string | null } | null;
  analyses: RadarPropertyAnalysisRow[];
  history: RadarPropertyStatusHistoryRow[];
  duplicateOf: { id: string; candidate_code: string } | null;
  convertedProperty: { id: string; property_code: string } | null;
}

export async function fetchRadarPropertyCandidateDetail(
  id: string
): Promise<RadarPropertyCandidateDetail | null> {
  const supabase = createAdminClient();

  const { data: candidate } = await supabase
    .from("radar_property_candidates")
    .select("*, radar_sources(source_type, name, source_url)")
    .eq("id", id)
    .maybeSingle();

  if (!candidate) return null;

  const [{ data: raw }, { data: analyses }, { data: history }, { data: duplicateOf }, { data: convertedProperty }] =
    await Promise.all([
      candidate.raw_id
        ? supabase
            .from("radar_property_raw")
            .select("raw_payload, content_fingerprint")
            .eq("id", candidate.raw_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("radar_property_analysis")
        .select("*")
        .eq("candidate_id", id)
        .order("version", { ascending: false }),
      supabase
        .from("radar_property_status_history")
        .select("id, from_status, to_status, changed_at, note, profiles(full_name)")
        .eq("candidate_id", id)
        .order("changed_at", { ascending: false }),
      candidate.duplicate_of_candidate_id
        ? supabase
            .from("radar_property_candidates")
            .select("id, candidate_code")
            .eq("id", candidate.duplicate_of_candidate_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("properties").select("id, property_code").eq("radar_property_candidate_id", id).maybeSingle(),
    ]);

  const source = candidate.radar_sources as unknown as
    | { source_type: string; name: string; source_url: string | null }
    | null;

  return {
    candidate,
    source,
    raw: raw ?? null,
    analyses: (analyses ?? []) as RadarPropertyAnalysisRow[],
    history: (history ?? []).map((row) => ({
      id: row.id as string,
      from_status: row.from_status as string | null,
      to_status: row.to_status as string,
      changed_at: row.changed_at as string,
      changed_by_name: (row.profiles as unknown as { full_name?: string } | null)?.full_name ?? null,
      note: row.note as string | null,
    })),
    duplicateOf: duplicateOf ? { id: duplicateOf.id as string, candidate_code: duplicateOf.candidate_code as string } : null,
    convertedProperty: convertedProperty
      ? { id: convertedProperty.id as string, property_code: convertedProperty.property_code as string }
      : null,
  };
}
