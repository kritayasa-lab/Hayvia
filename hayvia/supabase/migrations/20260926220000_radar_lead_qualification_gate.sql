-- =============================================================================
-- 20260926220000_radar_lead_qualification_gate.sql
-- =============================================================================
-- Lead Qualification Gate. Screening now happens BEFORE a raw signal becomes
-- a retained radar_lead_candidates row — a SELLER/OWNER/AGENT/ADVERTISEMENT/
-- NOISE post that the AI is confident is not a genuine seeker is discarded
-- and never creates a candidate at all. Only two retained outcomes remain:
-- QUALIFIED and NEEDS_REVIEW.
--
-- Two new columns on radar_lead_candidates (reuses the existing
-- lead_category column, PR #25, for the category axis — no duplicate):
--   poster_role   — SEEKER/OWNER/AGENT/UNKNOWN
--   qualification — QUALIFIED/NEEDS_REVIEW ONLY. 'DISCARD' is deliberately
--                   NOT a legal value here — the CHECK constraint itself
--                   enforces, at the database level, that a DISCARD verdict
--                   can never be represented as a retained candidate row.
--
-- One new table, radar_lead_screening: a lightweight record of every AI
-- qualification-gate verdict, independent of whether a candidate was ever
-- created. This is the mechanism for two things at once:
--   1. Dedup/idempotency — a raw row is screened at most once (unique index
--      on raw_id); "Classify Pending" treats a raw row as done once it has
--      ANY screening row, whatever the verdict, so a DISCARD is never
--      re-screened on every subsequent run.
--   2. A lightweight audit trail for discarded content (reason, confidence,
--      poster_role, category) WITHOUT retaining it as Lead Radar data.
--
-- Cascades with radar_lead_raw (on delete cascade) — screening history has
-- no meaning once the raw evidence it screened is gone. Does NOT cascade
-- with radar_lead_candidates (on delete set null) — a screening event
-- predates and outlives its optional candidate.
-- =============================================================================

alter table public.radar_lead_candidates
  add column poster_role text
    check (poster_role is null or poster_role in ('SEEKER', 'OWNER', 'AGENT', 'UNKNOWN')),
  add column qualification text
    check (qualification is null or qualification in ('QUALIFIED', 'NEEDS_REVIEW'));

comment on column public.radar_lead_candidates.poster_role is
  'SEEKER/OWNER/AGENT/UNKNOWN from the Lead Qualification Gate screening (radar_lead_screening). Null for candidates created before this gate existed, until reprocessed.';
comment on column public.radar_lead_candidates.qualification is
  'QUALIFIED or NEEDS_REVIEW ONLY — a DISCARD verdict never reaches this table by construction (see radar_lead_screening). Null for pre-gate candidates until reprocessed.';

create index ix_radar_lead_candidates_qualification
  on public.radar_lead_candidates (qualification)
  where qualification is not null;

create table public.radar_lead_screening (
  id uuid primary key default gen_random_uuid(),
  raw_id uuid not null references public.radar_lead_raw (id) on delete cascade,

  poster_role text check (poster_role is null or poster_role in ('SEEKER', 'OWNER', 'AGENT', 'UNKNOWN')),
  category text check (category is null or category in ('BUYER', 'RENTER', 'SELLER', 'NOISE')),
  qualification text not null check (qualification in ('QUALIFIED', 'NEEDS_REVIEW', 'DISCARD')),
  confidence numeric(5, 2) check (confidence is null or (confidence >= 0 and confidence <= 100)),
  reason text,

  model_name text,
  model_version text,

  -- Set only for QUALIFIED/NEEDS_REVIEW, once promoteRawLeadToCandidate()
  -- creates the candidate this screening event produced. Null for DISCARD.
  candidate_id uuid references public.radar_lead_candidates (id) on delete set null,

  created_at timestamptz not null default now()
);

comment on table public.radar_lead_screening is
  'One row per raw signal per screening attempt — the Lead Qualification Gate verdict (QUALIFIED/NEEDS_REVIEW/DISCARD), independent of whether a radar_lead_candidates row exists. A DISCARD writes only here, never a candidate. Lightweight by design: no full requirement extraction is stored for discarded content, only enough to dedup and audit the decision.';

create unique index ux_radar_lead_screening_raw_id on public.radar_lead_screening (raw_id);
create index ix_radar_lead_screening_qualification on public.radar_lead_screening (qualification);
