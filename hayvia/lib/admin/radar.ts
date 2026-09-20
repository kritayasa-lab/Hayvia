import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// -----------------------------------------------------------------------------
// Phase 8B — Radar Foundation admin data layer.
//
// Read-only, for the /admin/radar overview page only. Radar has no
// candidate-creation, review, or conversion actions yet — those belong to
// whichever future phase actually builds Property Radar / Lead Radar as
// features. This file only reads counts and recent rows, exactly what the
// foundation overview page needs.
// -----------------------------------------------------------------------------

// Statuses that mean "a human still needs to look at this" for each domain.
// Kept here (not duplicated at the call site) so the two lists — and any
// future page that needs the same definition — can't drift apart.
const PROPERTY_AWAITING_REVIEW_STATUSES = ["DISCOVERED", "AI_REVIEWED", "QUALIFIED"];
const LEAD_AWAITING_REVIEW_STATUSES = ["DISCOVERED", "AI_REVIEWED", "QUALIFIED"];

export interface RadarCandidateSummary {
  id: string;
  candidateCode: string;
  status: string;
  title: string;
  createdAt: string;
}

export interface RadarOverview {
  propertyCandidateCount: number;
  leadCandidateCount: number;
  propertyAwaitingReviewCount: number;
  leadAwaitingReviewCount: number;
  recentPropertyCandidates: RadarCandidateSummary[];
  recentLeadCandidates: RadarCandidateSummary[];
  recentlyQualifiedProperty: RadarCandidateSummary[];
  recentlyQualifiedLead: RadarCandidateSummary[];
}

export async function fetchRadarOverview(): Promise<RadarOverview> {
  const supabase = createAdminClient();

  const [
    propertyCandidateCount,
    leadCandidateCount,
    propertyAwaitingReviewCount,
    leadAwaitingReviewCount,
    recentPropertyCandidates,
    recentLeadCandidates,
    recentlyQualifiedProperty,
    recentlyQualifiedLead,
  ] = await Promise.all([
    supabase.from("radar_property_candidates").select("id", { count: "exact", head: true }),
    supabase.from("radar_lead_candidates").select("id", { count: "exact", head: true }),
    supabase
      .from("radar_property_candidates")
      .select("id", { count: "exact", head: true })
      .in("status", PROPERTY_AWAITING_REVIEW_STATUSES),
    supabase
      .from("radar_lead_candidates")
      .select("id", { count: "exact", head: true })
      .in("status", LEAD_AWAITING_REVIEW_STATUSES),
    supabase
      .from("radar_property_candidates")
      .select("id, candidate_code, status, city, district, property_type, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("radar_lead_candidates")
      .select("id, candidate_code, status, city, district, purpose, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("radar_property_candidates")
      .select("id, candidate_code, status, city, district, property_type, created_at")
      .eq("status", "QUALIFIED")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("radar_lead_candidates")
      .select("id, candidate_code, status, city, district, purpose, created_at")
      .eq("status", "QUALIFIED")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    propertyCandidateCount: propertyCandidateCount.count ?? 0,
    leadCandidateCount: leadCandidateCount.count ?? 0,
    propertyAwaitingReviewCount: propertyAwaitingReviewCount.count ?? 0,
    leadAwaitingReviewCount: leadAwaitingReviewCount.count ?? 0,
    recentPropertyCandidates: (recentPropertyCandidates.data ?? []).map(mapPropertyRow),
    recentLeadCandidates: (recentLeadCandidates.data ?? []).map(mapLeadRow),
    recentlyQualifiedProperty: (recentlyQualifiedProperty.data ?? []).map(mapPropertyRow),
    recentlyQualifiedLead: (recentlyQualifiedLead.data ?? []).map(mapLeadRow),
  };
}

interface RawPropertyRow {
  id: string;
  candidate_code: string;
  status: string;
  city: string | null;
  district: string | null;
  property_type: string | null;
  created_at: string;
}

function mapPropertyRow(row: RawPropertyRow): RadarCandidateSummary {
  return {
    id: row.id,
    candidateCode: row.candidate_code,
    status: row.status,
    title: [row.property_type, row.district, row.city].filter(Boolean).join(" · ") || "No details yet",
    createdAt: row.created_at,
  };
}

interface RawLeadRow {
  id: string;
  candidate_code: string;
  status: string;
  city: string | null;
  district: string | null;
  purpose: string | null;
  created_at: string;
}

function mapLeadRow(row: RawLeadRow): RadarCandidateSummary {
  return {
    id: row.id,
    candidateCode: row.candidate_code,
    status: row.status,
    title:
      [row.purpose === "BUY" ? "Buy" : row.purpose === "RENT" ? "Rent" : null, row.district, row.city]
        .filter(Boolean)
        .join(" · ") || "No details yet",
    createdAt: row.created_at,
  };
}
