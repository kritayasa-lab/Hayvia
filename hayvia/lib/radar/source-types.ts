// Mirrors radar_source_type_enum (20260920160000_radar_foundation.sql)
// exactly. No "server-only" here deliberately — this is plain literal data
// (not a secret, not a DB call), safe to import from client components that
// need to render a source-type dropdown (see LeadIngestionTestForm.tsx),
// as well as from server-only code that needs to validate against it (see
// lib/radar/lead-ingestion.ts). Kept in its own file specifically so
// neither side has to import the other's "server-only" module just to read
// this list.
export const RADAR_SOURCE_TYPES = ["FACEBOOK_GROUP", "GIMYONG", "GOOGLE", "PROPERTY_WEBSITE", "PARTNER_FEED", "MANUAL"] as const;
export type RadarSourceType = (typeof RADAR_SOURCE_TYPES)[number];
