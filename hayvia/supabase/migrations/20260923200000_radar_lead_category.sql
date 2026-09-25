-- =============================================================================
-- 20260923200000_radar_lead_category.sql
-- =============================================================================
-- PR #25 — Apify Lead Ingestion -> AI Classification -> Matching -> Admin Radar.
--
-- One nullable, denormalized column on radar_lead_candidates: lead_category.
-- Mirrors the exact precedent radar_property_candidates already set in
-- Phase 8D-2 (poster_type/acquisition_type): a small, indexed,
-- query-convenience copy of a conclusion whose full, versioned, evidenced
-- detail lives in radar_lead_analysis (the source of truth — see
-- lib/radar/lead-intelligence.ts, the only writer of this column, which
-- always writes it in the SAME operation/transaction as the
-- radar_lead_analysis row it mirrors, so the two can never diverge).
--
-- Why a new column instead of reusing `purpose` (listing_type_enum):
-- listing_type_enum only has RENT/BUY — it cannot represent SELLER or NOISE,
-- and must not be forced to (see this PR's design note: `purpose` keeps its
-- existing RENT/BUY matching-engine semantics untouched; `lead_category` is
-- a separate Radar-classification axis: BUYER/RENTER/SELLER/NOISE). A
-- BUYER/RENTER lead_category still gets `purpose` populated as BUY/RENT
-- respectively (existing column, existing semantics, unchanged) — this
-- migration adds nothing to that mapping, it only adds a place to record
-- the classification itself, including the two values `purpose` can't hold.
--
-- No change to listing_type_enum, radar_lead_status_enum, or any other
-- table. No change to RLS posture (candidates already deny-all/
-- service-role-only).
-- =============================================================================

alter table public.radar_lead_candidates
  add column lead_category text
    check (lead_category is null or lead_category in ('BUYER', 'RENTER', 'SELLER', 'NOISE'));

comment on column public.radar_lead_candidates.lead_category is
  'Denormalized from the latest radar_lead_analysis row''s category classification (BUYER/RENTER/SELLER/NOISE). Null until classified. Query/filter convenience only — radar_lead_analysis is the source of truth and this column is always written in the same operation as the analysis row it mirrors (see lib/radar/lead-intelligence.ts). Distinct from `purpose` (listing_type_enum, RENT/BUY only, drives matching engine semantics) — BUYER/RENTER also populate `purpose` as BUY/RENT; SELLER/NOISE never do, since listing_type_enum has no member for either.';

create index ix_radar_lead_candidates_lead_category
  on public.radar_lead_candidates (lead_category)
  where lead_category is not null;
