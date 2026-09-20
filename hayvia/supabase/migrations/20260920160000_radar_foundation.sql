-- =============================================================================
-- 20260920160000_radar_foundation.sql
-- =============================================================================
-- Phase 8B — RADAR Foundation.
--
-- Radar is a staging/intelligence layer, NOT the CRM. Nothing in this
-- migration creates real properties or real leads, and nothing here makes
-- Radar candidates behave like properties/leads — it only gives them a
-- place to exist, be reviewed, and (later, in a future phase) be approved
-- into the real system via the traceability columns added at the bottom.
--
-- Two independent domains, deliberately kept separate per the Phase 8
-- Blueprint and this phase's explicit instruction not to force Property
-- Radar and Lead Radar into one ambiguous status/history model:
--   - Property Radar: radar_property_raw / radar_property_candidates /
--     radar_property_analysis / radar_property_status_history
--   - Lead Radar:     radar_lead_raw / radar_lead_candidates /
--     radar_lead_analysis / radar_lead_status_history
-- Sharing only what's genuinely generic across both: radar_sources (a
-- source is a source regardless of what it feeds).
--
-- Pipeline shape per domain:
--   radar_sources
--     -> radar_{property,lead}_raw       (raw ingestion evidence, preserved)
--     -> radar_{property,lead}_candidates (normalized, reviewable)
--     -> radar_{property,lead}_analysis   (versioned AI output, FACT vs
--                                          AI_INFERENCE vs UNKNOWN kept apart)
--     -> radar_{property,lead}_status_history (per-candidate timeline)
--
-- Human-readable candidate identity (RADAR-P-000001 / RADAR-L-000001)
-- follows the exact same DB-generated, immutable pattern as
-- properties.property_code (see 20260919150000_property_code.sql):
-- dedicated sequence + BEFORE INSERT generator trigger (unconditionally
-- overwrites, never trusts the client) + BEFORE UPDATE trigger rejecting
-- any change once set. A Radar candidate code is a DIFFERENT identity from
-- a Property Code and never becomes one — see the traceability columns at
-- the bottom of this file for how a real property still gets its own,
-- separately-generated SP-###### code on conversion.
--
-- All Radar tables: RLS enabled, zero anon/authenticated policies (deny-all
-- by default, service-role only) — identical posture to every other
-- admin/staff-only table in this schema (seller_leads, leads, customers).
-- Radar is never read by any public-facing code path.
--
-- Deliberately NOT in this migration (see the accompanying implementation
-- report for the full reasoning):
--   - lead_source_type_enum's 'RADAR' value / chk_leads_source_relationship
--     update — deferred to whichever future phase actually implements Lead
--     conversion (nothing in 8B writes a RADAR-sourced leads row, so there
--     is no consumer yet, and ALTER TYPE ... ADD VALUE cannot safely be
--     referenced in the same transaction that adds it — confirmed against a
--     real Postgres 16 instance during this migration's development).
--   - Any AI-calling code, adapters, Apify/scraping integration, ingestion
--     workers, or an Opportunities table — all explicitly out of scope for
--     this foundation phase.
-- =============================================================================

-- -----------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------

-- Shared across both domains — a source is a source regardless of what it
-- feeds. No adapters for any of these are implemented in this phase.
create type radar_source_type_enum as enum (
  'FACEBOOK_GROUP',
  'GIMYONG',
  'GOOGLE',
  'PROPERTY_WEBSITE',
  'PARTNER_FEED',
  'MANUAL'
);

-- Property Radar lifecycle. Deliberately a flat set of values — Postgres
-- enums don't encode transition order, so the actual allowed-transition
-- rules (e.g. DISCOVERED -> AI_REVIEWED -> QUALIFIED -> ... -> CONVERTED,
-- with DISMISSED/DUPLICATE/EXPIRED/OWNER_DECLINED reachable as side-branches
-- rather than sequential steps) belong at the application layer in the
-- phase that actually builds the Review Queue, not encoded here.
create type radar_property_status_enum as enum (
  'DISCOVERED',
  'AI_REVIEWED',
  'QUALIFIED',
  'DISMISSED',
  'CONTACT_PENDING',
  'CONTACTED',
  'OWNER_INTERESTED',
  'OWNER_DECLINED',
  'INFO_COLLECTION',
  'CONVERTED',
  'DUPLICATE',
  'EXPIRED'
);

-- Lead Radar lifecycle — intentionally a SEPARATE enum from
-- radar_property_status_enum (this phase's explicit instruction: do not
-- force both domains into one ambiguous status enum). QUALIFIED_LEAD is
-- distinct from QUALIFIED: QUALIFIED means "worth pursuing", QUALIFIED_LEAD
-- means "responded and confirmed as real demand", immediately before
-- CONVERTED.
create type radar_lead_status_enum as enum (
  'DISCOVERED',
  'AI_REVIEWED',
  'QUALIFIED',
  'DISMISSED',
  'CONTACT_PENDING',
  'CONTACTED',
  'RESPONDED',
  'QUALIFIED_LEAD',
  'CONVERTED',
  'UNRESPONSIVE',
  'INVALID',
  'DUPLICATE',
  'EXPIRED'
);

-- -----------------------------------------------------------------------
-- radar_sources — shared source registry
-- -----------------------------------------------------------------------
-- Configuration only. No credentials/secrets ever belong in `config` —
-- adapter credentials (when adapters eventually exist) are an env-var /
-- server-only concern, exactly like GOOGLE_APPS_SCRIPT_BACKUP_URL and
-- SUPABASE_SERVICE_ROLE_KEY already are in this codebase. `config` is only
-- for non-secret adapter settings (e.g. a Facebook group's display name,
-- a search radius) once an adapter is actually built.
create table public.radar_sources (
  id uuid primary key default gen_random_uuid(),

  source_type radar_source_type_enum not null,
  name text not null,
  source_url text,
  source_identifier text,

  is_active boolean not null default true,
  config jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.radar_sources is
  'Phase 8B — generic registry of Radar discovery sources, shared by Property Radar and Lead Radar. No adapters are implemented yet; MANUAL is the only source type actually usable until a future phase adds real adapters. Never store credentials in `config`.';

create index ix_radar_sources_type on public.radar_sources (source_type);
create index ix_radar_sources_active on public.radar_sources (is_active) where is_active = true;

-- =============================================================================
-- PROPERTY RADAR
-- =============================================================================

-- -----------------------------------------------------------------------
-- radar_property_raw — raw ingestion evidence, kept separate from the
-- normalized candidate below
-- -----------------------------------------------------------------------
create table public.radar_property_raw (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null references public.radar_sources (id) on delete restrict,
  source_url text,
  source_identifier text,

  raw_payload jsonb not null default '{}',
  content_fingerprint text,

  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  created_at timestamptz not null default now()
);

comment on table public.radar_property_raw is
  'Phase 8B — one row per raw property discovery event, preserved as evidence and kept separate from the normalized public.radar_property_candidates row(s) built from it. Never written directly into public.properties.';

-- Prevents re-ingesting the exact same source record as a duplicate raw row;
-- re-ingestion of an already-seen (source_id, source_identifier) should
-- update last_seen_at on the existing row instead (application-layer
-- concern in whichever future phase performs real ingestion).
create unique index ux_radar_property_raw_source_identifier
  on public.radar_property_raw (source_id, source_identifier)
  where source_identifier is not null;

create index ix_radar_property_raw_source on public.radar_property_raw (source_id);
create index ix_radar_property_raw_fingerprint
  on public.radar_property_raw (content_fingerprint)
  where content_fingerprint is not null;

-- -----------------------------------------------------------------------
-- radar_property_candidates — the normalized, reviewable candidate
-- -----------------------------------------------------------------------
create table public.radar_property_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_code text not null,

  raw_id uuid references public.radar_property_raw (id) on delete set null,

  -- Denormalized from the originating raw record for fast direct access
  -- (a candidate's own canonical source view) — radar_property_raw remains
  -- the full historical evidence log if/when a candidate is later
  -- reconciled from more than one raw sighting.
  source_id uuid not null references public.radar_sources (id) on delete restrict,
  source_url text,
  source_identifier text,

  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  status radar_property_status_enum not null default 'DISCOVERED',

  -- Normalized facts — same column shapes as properties/seller_leads for
  -- consistency, deliberately no new location/price/etc. representation.
  property_type property_type_enum,
  province text,
  city text,
  district text,
  price numeric(12, 2),
  bedrooms smallint check (bedrooms is null or bedrooms >= 0),
  bathrooms smallint check (bathrooms is null or bathrooms >= 0),
  size_sqm numeric(10, 2) check (size_sqm is null or size_sqm >= 0),
  description text,

  -- Deduplication foundation — no matching algorithm implemented yet; this
  -- only gives a future dedup pass somewhere to record its conclusion.
  -- Title similarity alone is explicitly NOT the identity signal here —
  -- see content_fingerprint (on radar_property_raw) and the normalized
  -- facts above for what a future pass should actually compare on.
  duplicate_of_candidate_id uuid references public.radar_property_candidates (id) on delete set null,
  duplicate_confidence numeric(5, 2)
    check (duplicate_confidence is null or (duplicate_confidence >= 0 and duplicate_confidence <= 100)),

  -- Human review
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.radar_property_candidates is
  'Phase 8B — a Property Radar candidate: NOT a real property. Identified by candidate_code (RADAR-P-000001, immutable, DB-generated — see triggers below), never by properties.id or properties.property_code. Becomes a real property only via explicit human approval in a future phase, at which point properties.radar_property_candidate_id (see bottom of this file) points back here.';

create unique index ux_radar_property_candidates_code on public.radar_property_candidates (candidate_code);
create index ix_radar_property_candidates_status on public.radar_property_candidates (status);
create index ix_radar_property_candidates_source on public.radar_property_candidates (source_id);
create index ix_radar_property_candidates_raw on public.radar_property_candidates (raw_id);
create index ix_radar_property_candidates_duplicate_of on public.radar_property_candidates (duplicate_of_candidate_id);

-- -----------------------------------------------------------------------
-- radar_property_analysis — versioned AI output
-- -----------------------------------------------------------------------
-- Append-only: a new row per (re-)analysis run, never overwritten, so
-- model/prompt changes and re-analysis history stay auditable. facts,
-- ai_inference, and unknowns are kept as separate jsonb fields so AI output
-- can never silently masquerade as verified fact. human_override is
-- separate from the AI's own output — a human correction is layered on
-- top, never destructively edits what the AI actually produced.
create table public.radar_property_analysis (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.radar_property_candidates (id) on delete cascade,
  version integer not null check (version > 0),

  -- Deliberately nullable, no provider hard-coded — this phase implements
  -- no AI calls at all, only the schema shape a future analysis pass will
  -- write into.
  model_name text,
  model_version text,

  facts jsonb not null default '{}',
  ai_inference jsonb not null default '{}',
  unknowns jsonb not null default '[]',
  confidence numeric(5, 2) check (confidence is null or (confidence >= 0 and confidence <= 100)),
  evidence jsonb not null default '{}',
  human_override jsonb,

  created_at timestamptz not null default now(),

  unique (candidate_id, version)
);

comment on table public.radar_property_analysis is
  'Phase 8B — versioned AI analysis output for one Property Radar candidate. facts/ai_inference/unknowns are kept structurally separate so an AI inference can never silently become a stored fact. No AI calls are implemented in this phase; this is schema only.';

create index ix_radar_property_analysis_candidate on public.radar_property_analysis (candidate_id, version desc);

-- -----------------------------------------------------------------------
-- radar_property_status_history — per-candidate timeline
-- -----------------------------------------------------------------------
-- Mirrors the existing lead_status_history table's exact shape (see
-- 20260912100005_leads_and_inquiries.sql) — same established pattern,
-- applied to a new domain, not a new pattern. Kept as its own table rather
-- than a shared property+lead history table specifically so the two
-- domains' histories can never be ambiguous about which lifecycle a given
-- from_status/to_status pair belongs to.
create table public.radar_property_status_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.radar_property_candidates (id) on delete cascade,
  from_status radar_property_status_enum,
  to_status radar_property_status_enum not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

comment on table public.radar_property_status_history is
  'Phase 8B — status transition log for Property Radar candidates only. See radar_lead_status_history for the separate Lead Radar equivalent — the two are never combined into one ambiguous table.';

create index ix_radar_property_status_history_candidate
  on public.radar_property_status_history (candidate_id, changed_at desc);

-- =============================================================================
-- LEAD RADAR
-- =============================================================================

-- -----------------------------------------------------------------------
-- radar_lead_raw — raw ingestion evidence
-- -----------------------------------------------------------------------
create table public.radar_lead_raw (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null references public.radar_sources (id) on delete restrict,
  source_url text,
  source_identifier text,

  raw_payload jsonb not null default '{}',
  content_fingerprint text,

  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  created_at timestamptz not null default now()
);

comment on table public.radar_lead_raw is
  'Phase 8B — one row per raw lead/demand-signal discovery event, preserved as evidence and kept separate from the normalized public.radar_lead_candidates row(s) built from it. Never written directly into public.leads.';

create unique index ux_radar_lead_raw_source_identifier
  on public.radar_lead_raw (source_id, source_identifier)
  where source_identifier is not null;

create index ix_radar_lead_raw_source on public.radar_lead_raw (source_id);
create index ix_radar_lead_raw_fingerprint
  on public.radar_lead_raw (content_fingerprint)
  where content_fingerprint is not null;

-- -----------------------------------------------------------------------
-- radar_lead_candidates — the normalized, reviewable candidate
-- -----------------------------------------------------------------------
create table public.radar_lead_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_code text not null,

  raw_id uuid references public.radar_lead_raw (id) on delete set null,

  source_id uuid not null references public.radar_sources (id) on delete restrict,
  source_url text,
  source_identifier text,

  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  status radar_lead_status_enum not null default 'DISCOVERED',

  -- Normalized demand facts. purpose/property_type deliberately reuse the
  -- EXISTING listing_type_enum / property_type_enum rather than inventing
  -- parallel Radar-only enums for the same concepts.
  purpose listing_type_enum,
  property_type property_type_enum,
  budget_min numeric(12, 2),
  budget_max numeric(12, 2),
  province text,
  city text,
  district text,
  bedrooms smallint check (bedrooms is null or bedrooms >= 0),
  timeline text,

  -- Contact identifiers — legally sensitive (see security posture: RLS
  -- deny-all, never exposed publicly, same treatment as seller_leads'
  -- contact fields). Nullable: not always available/appropriate at
  -- discovery time.
  contact_name text,
  contact_phone text,
  contact_email text,

  notes_from_source text,

  -- Deduplication foundation — same posture as Property Radar: no
  -- algorithm yet, just a place for a future pass to record its result.
  duplicate_of_candidate_id uuid references public.radar_lead_candidates (id) on delete set null,
  duplicate_confidence numeric(5, 2)
    check (duplicate_confidence is null or (duplicate_confidence >= 0 and duplicate_confidence <= 100)),

  -- Human review
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_radar_lead_candidates_budget
    check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

comment on table public.radar_lead_candidates is
  'Phase 8B — a Lead Radar candidate: NOT a real CRM lead. Identified by candidate_code (RADAR-L-000001, immutable, DB-generated). Becomes a real leads row only via explicit human approval in a future phase, using leads.radar_lead_candidate_id (see bottom of this file) for traceability.';

create unique index ux_radar_lead_candidates_code on public.radar_lead_candidates (candidate_code);
create index ix_radar_lead_candidates_status on public.radar_lead_candidates (status);
create index ix_radar_lead_candidates_source on public.radar_lead_candidates (source_id);
create index ix_radar_lead_candidates_raw on public.radar_lead_candidates (raw_id);
create index ix_radar_lead_candidates_duplicate_of on public.radar_lead_candidates (duplicate_of_candidate_id);

-- -----------------------------------------------------------------------
-- radar_lead_analysis — versioned AI output
-- -----------------------------------------------------------------------
create table public.radar_lead_analysis (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.radar_lead_candidates (id) on delete cascade,
  version integer not null check (version > 0),

  model_name text,
  model_version text,

  facts jsonb not null default '{}',
  ai_inference jsonb not null default '{}',
  unknowns jsonb not null default '[]',

  -- Intent classification kept as a bounded category alongside a numeric
  -- score, rather than only a raw number — a category avoids presenting a
  -- false sense of precision the way a bare "73% intent" figure would.
  intent_category text
    check (intent_category is null or intent_category in ('STRONG_INTENT', 'PROBABLE_INTENT', 'WEAK_INTENT', 'NOISE_SPAM')),
  intent_score numeric(5, 2) check (intent_score is null or (intent_score >= 0 and intent_score <= 100)),
  confidence numeric(5, 2) check (confidence is null or (confidence >= 0 and confidence <= 100)),

  evidence jsonb not null default '{}',
  human_override jsonb,

  created_at timestamptz not null default now(),

  unique (candidate_id, version)
);

comment on table public.radar_lead_analysis is
  'Phase 8B — versioned AI analysis output for one Lead Radar candidate, including intent classification. No AI calls are implemented in this phase; this is schema only. Never claims certainty that a contact is genuine — intent_category/intent_score are estimates, not verified fact.';

create index ix_radar_lead_analysis_candidate on public.radar_lead_analysis (candidate_id, version desc);

-- -----------------------------------------------------------------------
-- radar_lead_status_history — per-candidate timeline
-- -----------------------------------------------------------------------
create table public.radar_lead_status_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.radar_lead_candidates (id) on delete cascade,
  from_status radar_lead_status_enum,
  to_status radar_lead_status_enum not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

comment on table public.radar_lead_status_history is
  'Phase 8B — status transition log for Lead Radar candidates only. See radar_property_status_history for the separate Property Radar equivalent.';

create index ix_radar_lead_status_history_candidate
  on public.radar_lead_status_history (candidate_id, changed_at desc);

-- =============================================================================
-- Human-readable candidate ID generation — DB-generated, immutable,
-- concurrency-safe. Exact same pattern as properties.property_code
-- (20260919150000_property_code.sql): a dedicated sequence + a BEFORE
-- INSERT trigger that unconditionally overwrites whatever (if anything)
-- the caller supplied, + a BEFORE UPDATE trigger that rejects any change
-- once set. Never generated in application/client code.
-- =============================================================================

create sequence public.radar_property_candidate_code_seq;
create sequence public.radar_lead_candidate_code_seq;

create or replace function public.generate_radar_property_candidate_code()
returns trigger
language plpgsql
as $$
begin
  new.candidate_code := 'RADAR-P-' || lpad(nextval('public.radar_property_candidate_code_seq')::text, 6, '0');
  return new;
end;
$$;

create trigger trg_radar_property_candidates_generate_code
  before insert on public.radar_property_candidates
  for each row
  execute function public.generate_radar_property_candidate_code();

create or replace function public.protect_radar_property_candidate_code()
returns trigger
language plpgsql
as $$
begin
  if old.candidate_code is not null and new.candidate_code is distinct from old.candidate_code then
    raise exception 'radar_property_candidates.candidate_code is immutable and cannot be changed (attempted % -> %)',
      old.candidate_code, new.candidate_code;
  end if;
  return new;
end;
$$;

create trigger trg_radar_property_candidates_protect_code
  before update on public.radar_property_candidates
  for each row
  execute function public.protect_radar_property_candidate_code();

alter table public.radar_property_candidates
  add constraint chk_radar_property_candidates_code_format
  check (candidate_code ~ '^RADAR-P-[0-9]{6,}$');

create or replace function public.generate_radar_lead_candidate_code()
returns trigger
language plpgsql
as $$
begin
  new.candidate_code := 'RADAR-L-' || lpad(nextval('public.radar_lead_candidate_code_seq')::text, 6, '0');
  return new;
end;
$$;

create trigger trg_radar_lead_candidates_generate_code
  before insert on public.radar_lead_candidates
  for each row
  execute function public.generate_radar_lead_candidate_code();

create or replace function public.protect_radar_lead_candidate_code()
returns trigger
language plpgsql
as $$
begin
  if old.candidate_code is not null and new.candidate_code is distinct from old.candidate_code then
    raise exception 'radar_lead_candidates.candidate_code is immutable and cannot be changed (attempted % -> %)',
      old.candidate_code, new.candidate_code;
  end if;
  return new;
end;
$$;

create trigger trg_radar_lead_candidates_protect_code
  before update on public.radar_lead_candidates
  for each row
  execute function public.protect_radar_lead_candidate_code();

alter table public.radar_lead_candidates
  add constraint chk_radar_lead_candidates_code_format
  check (candidate_code ~ '^RADAR-L-[0-9]{6,}$');

-- =============================================================================
-- Row Level Security — deny-all by default (service-role/admin only),
-- identical posture to every other staff-only table in this schema
-- (seller_leads, leads, customers, backup_logs, audit_logs). No
-- anon/authenticated policies are added for any Radar table — Radar is
-- never read by any public-facing code path.
-- =============================================================================

alter table public.radar_sources enable row level security;
alter table public.radar_property_raw enable row level security;
alter table public.radar_property_candidates enable row level security;
alter table public.radar_property_analysis enable row level security;
alter table public.radar_property_status_history enable row level security;
alter table public.radar_lead_raw enable row level security;
alter table public.radar_lead_candidates enable row level security;
alter table public.radar_lead_analysis enable row level security;
alter table public.radar_lead_status_history enable row level security;

-- =============================================================================
-- Conversion traceability — a real, single-purpose nullable FK from the
-- real table back to its originating Radar candidate, mirroring the exact
-- precedent already established by properties.seller_lead_id (Phase 7,
-- 20260919130000_property_seller_lead_link.sql). No converted_property_id
-- (or equivalent) is added on the candidate side — the forward FK below is
-- sufficient, and a reverse lookup is a simple indexed query
-- (select * from properties where radar_property_candidate_id = $1) when
-- needed, avoiding a redundant/duplicated identity per this phase's
-- explicit "prefer the minimum schema" instruction.
--
-- Nothing in this migration or this phase writes to either of these
-- columns — no "approve and create property/lead" action exists yet. This
-- only prepares the schema so a future phase's conversion action has
-- somewhere to record the link, exactly as instructed.
--
-- A converted property still receives its own, separately-generated
-- SP-###### property_code via the existing trigger from
-- 20260919150000_property_code.sql — no second property identity system is
-- introduced here.
-- =============================================================================

alter table public.properties
  add column radar_property_candidate_id uuid references public.radar_property_candidates (id) on delete set null;

comment on column public.properties.radar_property_candidate_id is
  'Optional traceability link to the Radar candidate this property was created from, once Radar conversion exists (not implemented in Phase 8B). Null for properties created directly by staff or from a Seller Lead. Admin-only.';

create index ix_properties_radar_candidate on public.properties (radar_property_candidate_id);

alter table public.leads
  add column radar_lead_candidate_id uuid references public.radar_lead_candidates (id) on delete set null;

comment on column public.leads.radar_lead_candidate_id is
  'Optional traceability link to the Radar Lead candidate this CRM lead was created from, once Radar Lead conversion exists (not implemented in Phase 8B). Deliberately NOT yet added to lead_source_type_enum or chk_leads_source_relationship — see this migration''s header comment for why that is safely deferred to whichever future phase actually writes a RADAR-sourced leads row.';

create index ix_leads_radar_candidate on public.leads (radar_lead_candidate_id);
