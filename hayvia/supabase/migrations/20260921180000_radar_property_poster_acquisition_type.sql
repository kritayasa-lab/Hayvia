-- =============================================================================
-- 20260921180000_radar_property_poster_acquisition_type.sql
-- =============================================================================
-- Phase 8D-2 — AI Property Intelligence contract, schema half.
--
-- Two nullable, denormalized columns on radar_property_candidates:
-- poster_type and acquisition_type. Mirrors the exact precedent this table
-- already set in Phase 8B (source_url/source_identifier denormalized from
-- radar_property_raw "for fast direct access") — a small, indexed,
-- query-convenience copy of a conclusion whose full, versioned, evidenced
-- detail lives elsewhere (radar_property_analysis.ai_inference/evidence).
-- These two columns are never the source of truth and are never written to
-- directly by anything other than the AI analysis persistence path syncing
-- them from the latest analysis row — see lib/radar/ai-analysis.ts and
-- app/admin/(dashboard)/radar/properties/actions.ts (runAiAnalysisAction).
--
-- Both null until a candidate has actually been analyzed. No AI provider is
-- configured in this phase (see radar_property_analysis's own Phase 8B
-- comment) — this migration only prepares the schema so a future analysis
-- write has somewhere to record its conclusion for list filtering/sorting,
-- exactly as instructed.
--
-- Deliberately NOT included, per Phase 8D-1's explicit scope: any score
-- column, any acquisition_priority column. Both remain "define, don't
-- compute" until a real formula exists to write them — see Phase 8D-1's
-- design report for the reasoning.
--
-- No change to radar_property_status_enum, no change to any other table,
-- no change to RLS posture (candidates already deny-all/service-role-only).
-- =============================================================================

alter table public.radar_property_candidates
  add column poster_type text
    check (poster_type is null or poster_type in ('OWNER', 'AGENT', 'AGENCY', 'UNKNOWN')),
  add column acquisition_type text
    check (acquisition_type is null or acquisition_type in ('OWNER_DIRECT', 'OPEN_CO_BROKER', 'AGENT_ONLY', 'UNKNOWN'));

comment on column public.radar_property_candidates.poster_type is
  'Denormalized from the latest radar_property_analysis row''s poster classification (evidence-based: OWNER/AGENT/AGENCY/UNKNOWN). Null until analyzed. Query convenience only — the full classification with confidence/evidence lives in radar_property_analysis.ai_inference.';
comment on column public.radar_property_candidates.acquisition_type is
  'Denormalized from the latest radar_property_analysis row''s acquisition classification (OWNER_DIRECT/OPEN_CO_BROKER/AGENT_ONLY/UNKNOWN). Null until analyzed. Drives the Property Radar list filter — see app/admin/(dashboard)/radar/properties/page.tsx. Query convenience only — full detail lives in radar_property_analysis.';

-- Only acquisition_type gets an index: it's the one the list page actually
-- filters by (Phase 8D-2 UI). poster_type is displayed but not filtered on
-- yet, so an index for it isn't earning its keep — add one later if/when a
-- poster_type filter is actually built, per this schema's established
-- "minimum schema, add real columns/indexes only when there's a real
-- consumer" discipline (see radar_foundation.sql's own header comment).
create index ix_radar_property_candidates_acquisition_type
  on public.radar_property_candidates (acquisition_type)
  where acquisition_type is not null;
