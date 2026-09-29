-- =============================================================================
-- Radar removal — database cleanup (PR 31)
-- =============================================================================
-- This migration is destructive and removes all Radar tables, Radar enums,
-- and Radar foreign-key wiring after PR #30 removed all application-level
-- Radar references.
--
-- Context: the product direction changed from an autonomous lead/property
-- discovery pipeline ("Radar") to a simple Real Estate Website + Admin CMS
-- with a future AI-assisted property import (paste URL -> AI extraction ->
-- draft -> admin review -> publish). PR #30 deleted every Radar code path
-- (lib/radar/, app/admin/(dashboard)/radar/, all Radar server actions and
-- RPC callers). This migration retires the database objects that code used
-- to call. There is NO data migration here: Radar data (candidates, raw
-- payloads, analysis, screening, status history, sources) is intentionally
-- discarded, not carried into properties/leads. Property CMS data, public
-- properties, the Matching Engine, and app/api/match are untouched.
--
-- Every dependency below was verified directly against the 7 Radar-named
-- migration files (20260920160000, 20260920170000, 20260921180000,
-- 20260922190000, 20260923200000, 20260926210000, 20260926220000) rather
-- than assumed from a prior summary. Two object categories were found that
-- are NOT auto-dropped by `DROP TABLE` and are NOT part of the originally
-- expected object list, so they are called out explicitly:
--
--   1. `public.insert_radar_property_analysis(...)` (added in
--      20260922190000_radar_property_analysis_safe_versioning.sql) has
--      `returns public.radar_property_analysis` — a hard dependency on
--      that table's row type. Postgres refuses `DROP TABLE
--      radar_property_analysis` while this function still exists and
--      returns its composite type, so the function must be dropped first.
--      Its only caller (app/admin/(dashboard)/radar/properties/actions.ts)
--      was deleted in PR #30 — it is now orphaned.
--
--   2. The candidate-code generator/guard trigger functions
--      (`generate_radar_property_candidate_code`,
--      `protect_radar_property_candidate_code`,
--      `generate_radar_lead_candidate_code`,
--      `protect_radar_lead_candidate_code`) and their backing sequences
--      (`radar_property_candidate_code_seq`, `radar_lead_candidate_code_seq`)
--      are standalone objects. `DROP TABLE` on radar_property_candidates /
--      radar_lead_candidates auto-drops the *triggers* defined on those
--      tables (trg_radar_*_generate_code, trg_radar_*_protect_code), but
--      the trigger *functions* and the sequences they call `nextval()` on
--      are not owned by the table and are not auto-dropped. Verified no
--      other table in the schema uses these functions/sequences (repo-wide
--      grep for "radar" across supabase/migrations/*.sql matched only the
--      7 Radar-named files).
--
-- Deliberately no CASCADE anywhere in this file: every drop is IF EXISTS
-- and ordered so it should never need one. If an unexpected dependency
-- exists (e.g. an object added outside these 7 migrations that references
-- something below), the corresponding statement will fail loudly instead
-- of silently sweeping away an object this migration doesn't know about.
--
-- SAFE DROP ORDER (children before parents):
--   1. Cross-table FK columns/indexes on non-Radar tables:
--      properties.radar_property_candidate_id (+ ux/ix indexes),
--      leads.radar_lead_candidate_id (+ ix index)
--   2. public.insert_radar_property_analysis(...) — orphaned function with
--      a hard dependency on radar_property_analysis's row type
--   3. Leaf/history/analysis tables: radar_lead_screening,
--      radar_lead_analysis, radar_lead_status_history,
--      radar_property_analysis, radar_property_status_history
--   4. Candidate tables: radar_lead_candidates, radar_property_candidates
--   5. Raw tables: radar_lead_raw, radar_property_raw
--   6. Root table: radar_sources
--   7. Orphaned trigger functions: generate_radar_property_candidate_code,
--      protect_radar_property_candidate_code,
--      generate_radar_lead_candidate_code,
--      protect_radar_lead_candidate_code
--   8. Orphaned sequences: radar_property_candidate_code_seq,
--      radar_lead_candidate_code_seq
--   9. Enums (only once every column using them is gone):
--      radar_lead_status_enum, radar_property_status_enum,
--      radar_source_type_enum
--
-- Not touched by this migration (pre-existing, shared, non-Radar):
-- property_type_enum, listing_type_enum, lead_source_type_enum,
-- profiles, properties (aside from the one dropped column), leads (aside
-- from the one dropped column).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cross-table FK columns/indexes on properties and leads
-- -----------------------------------------------------------------------------

drop index if exists public.ux_properties_radar_candidate;
drop index if exists public.ix_properties_radar_candidate;
alter table public.properties drop column if exists radar_property_candidate_id;

drop index if exists public.ix_leads_radar_candidate;
alter table public.leads drop column if exists radar_lead_candidate_id;

-- -----------------------------------------------------------------------------
-- 2. Orphaned function with a hard dependency on radar_property_analysis's
--    row type — must be dropped before that table.
-- -----------------------------------------------------------------------------

drop function if exists public.insert_radar_property_analysis(
  uuid, text, text, jsonb, jsonb, jsonb, numeric, jsonb
);

-- -----------------------------------------------------------------------------
-- 3. Leaf / history / analysis tables (nothing else references these)
-- -----------------------------------------------------------------------------

drop table if exists public.radar_lead_screening;
drop table if exists public.radar_lead_analysis;
drop table if exists public.radar_lead_status_history;
drop table if exists public.radar_property_analysis;
drop table if exists public.radar_property_status_history;

-- -----------------------------------------------------------------------------
-- 4. Candidate tables — self-referential (duplicate_of_candidate_id) and
--    referenced by the raw tables (raw_id) and radar_sources (source_id).
--    Dropping these also drops their own generate/protect-code triggers
--    (trg_radar_*_generate_code, trg_radar_*_protect_code); the underlying
--    trigger functions are dropped separately in step 7 below.
-- -----------------------------------------------------------------------------

drop table if exists public.radar_lead_candidates;
drop table if exists public.radar_property_candidates;

-- -----------------------------------------------------------------------------
-- 5. Raw tables — referenced by radar_sources (source_id)
-- -----------------------------------------------------------------------------

drop table if exists public.radar_lead_raw;
drop table if exists public.radar_property_raw;

-- -----------------------------------------------------------------------------
-- 6. Root table — referenced by both raw tables and both candidate tables,
--    all now dropped above.
-- -----------------------------------------------------------------------------

drop table if exists public.radar_sources;

-- -----------------------------------------------------------------------------
-- 7. Orphaned trigger functions (their triggers were auto-dropped with the
--    candidate tables in step 4; the functions themselves are standalone).
-- -----------------------------------------------------------------------------

drop function if exists public.generate_radar_property_candidate_code();
drop function if exists public.protect_radar_property_candidate_code();
drop function if exists public.generate_radar_lead_candidate_code();
drop function if exists public.protect_radar_lead_candidate_code();

-- -----------------------------------------------------------------------------
-- 8. Orphaned sequences backing the dropped candidate-code generator
--    functions above. Not owned by any column (no SERIAL/IDENTITY), so not
--    auto-dropped by any of the table drops above.
-- -----------------------------------------------------------------------------

drop sequence if exists public.radar_property_candidate_code_seq;
drop sequence if exists public.radar_lead_candidate_code_seq;

-- -----------------------------------------------------------------------------
-- 9. Enums — only after every table/column using them is gone.
-- -----------------------------------------------------------------------------

drop type if exists public.radar_lead_status_enum;
drop type if exists public.radar_property_status_enum;
drop type if exists public.radar_source_type_enum;
