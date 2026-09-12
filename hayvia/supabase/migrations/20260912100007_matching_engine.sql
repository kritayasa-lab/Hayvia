-- =============================================================================
-- 20260912100007_matching_engine.sql
-- =============================================================================
-- matching_preferences, matching_results (both required, section 14/15), and
-- matching_weights — an ADDITION beyond the explicit table list, added
-- because section 14 explicitly asks for weights that "can later be changed
-- from Admin Settings." Flagged for your review below and in the final report.
-- =============================================================================

-- -----------------------------------------------------------------------
-- matching_preferences
-- -----------------------------------------------------------------------
create table public.matching_preferences (
  id uuid primary key default gen_random_uuid(),

  -- Anonymous visitors can run the matching flow before creating an account;
  -- session_id makes that possible, and the row can be linked to a user_id
  -- later if they sign up. Exactly one of the two is expected to be set.
  user_id uuid references public.profiles (id) on delete cascade,
  session_id text,

  purpose listing_type_enum not null, -- RENT or BUY (section 14, step 1)
  province text,
  city text,
  district text,

  budget_min numeric(12, 2),
  budget_max numeric(12, 2),
  property_type property_type_enum,
  bedrooms smallint check (bedrooms >= 0),
  bathrooms smallint check (bathrooms >= 0),
  furnished furnished_enum,
  parking boolean,

  lifestyle_preferences lifestyle_preference_enum[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_matching_preferences_identity check (user_id is not null or session_id is not null),
  constraint chk_matching_preferences_budget check (
    budget_min is null or budget_max is null or budget_min <= budget_max
  )
);

comment on table public.matching_preferences is
  'One row per matching quiz run (section 15). lifestyle_preferences is a Postgres enum array — see DATABASE_SCHEMA.md for why a junction table was not used here.';

create index ix_matching_preferences_user on public.matching_preferences (user_id);
create index ix_matching_preferences_session on public.matching_preferences (session_id);
create index ix_matching_preferences_lifestyle on public.matching_preferences using gin (lifestyle_preferences);

-- Now that matching_preferences exists, add the FK deferred from migration 5.
alter table public.leads
  add constraint fk_leads_matching_preference foreign key (matching_preference_id)
  references public.matching_preferences (id) on delete set null;

create index ix_leads_matching_preference on public.leads (matching_preference_id);

-- -----------------------------------------------------------------------
-- matching_results
-- -----------------------------------------------------------------------
create table public.matching_results (
  id uuid primary key default gen_random_uuid(),
  matching_preference_id uuid not null references public.matching_preferences (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,

  match_score numeric(5, 2) not null check (match_score >= 0 and match_score <= 100),
  -- Per-component scores (budget/location/property_type/bedrooms/lifestyle/
  -- amenities/availability) stored for transparency and so the weighting can
  -- be tuned later without re-deriving what drove a historical score.
  score_breakdown jsonb not null default '{}',

  created_at timestamptz not null default now(),

  unique (matching_preference_id, property_id)
);

comment on table public.matching_results is
  'Calculated match results for one matching_preferences run (section 14). Always computed from real data — never hardcoded.';

create index ix_matching_results_preference on public.matching_results (matching_preference_id, match_score desc);
create index ix_matching_results_property on public.matching_results (property_id);

-- -----------------------------------------------------------------------
-- matching_weights — ADDITION: lets an admin change the scoring weighting
-- (section 14's example: Budget 30%, Location 25%, Property Type 15%,
-- Bedrooms 10%, Lifestyle 10%, Amenities 5%, Availability 5%) without a code
-- deploy. Only one row should be active at a time (enforced below); the
-- matching engine (Phase 9) reads whichever row has is_active = true.
-- -----------------------------------------------------------------------
create table public.matching_weights (
  id uuid primary key default gen_random_uuid(),
  budget_weight numeric(5, 2) not null,
  location_weight numeric(5, 2) not null,
  property_type_weight numeric(5, 2) not null,
  bedrooms_weight numeric(5, 2) not null,
  lifestyle_weight numeric(5, 2) not null,
  amenities_weight numeric(5, 2) not null,
  availability_weight numeric(5, 2) not null,
  is_active boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_matching_weights_sum_100 check (
    budget_weight + location_weight + property_type_weight + bedrooms_weight
    + lifestyle_weight + amenities_weight + availability_weight = 100
  )
);

comment on table public.matching_weights is
  'Admin-configurable matching engine weights (section 14). Exactly one row should have is_active = true at any time — see ux_matching_weights_one_active below.';

create unique index ux_matching_weights_one_active
  on public.matching_weights (is_active)
  where is_active = true;

-- Seed the default weighting given in section 14's example so the matching
-- engine has a sane default the moment it's built in Phase 9.
insert into public.matching_weights (
  budget_weight, location_weight, property_type_weight, bedrooms_weight,
  lifestyle_weight, amenities_weight, availability_weight, is_active
) values (
  30, 25, 15, 10, 10, 5, 5, true
);
