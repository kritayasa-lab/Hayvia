-- =============================================================================
-- 20260912100005_leads_and_inquiries.sql
-- =============================================================================
-- seller_leads (section 8), inquiries (section 11), the unified CRM `leads`
-- table (section 21) with lead_notes + lead_status_history, and viewings
-- (section 22).
--
-- DESIGN NOTE — why both `inquiries`/`seller_leads` AND `leads` exist:
-- `inquiries` and `seller_leads` are the raw capture tables — exactly what
-- the customer submitted, tied to the specific form (a property inquiry, or
-- a Sell Your Property submission). `leads` is the CRM/work-queue layer on
-- top: one row per thing staff need to follow up on, with a uniform status
-- pipeline, assignment, and follow-up date, regardless of whether it came
-- from an inquiry, a seller lead, a matching session, or Get Matched. A
-- `leads` row optionally points back to its originating record via
-- inquiry_id / seller_lead_id / matching_preference_id (exactly one of
-- these is expected to be set for those source types; MANUAL/GET_MATCHED
-- leads have none). See DATABASE_SCHEMA.md for the full rationale.
-- =============================================================================

-- -----------------------------------------------------------------------
-- seller_leads
-- -----------------------------------------------------------------------
create table public.seller_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null, -- nullable: guest sellers allowed

  full_name text not null,
  email text not null,
  phone text not null,

  property_type property_type_enum,
  province text,
  city text,
  district text,

  expected_price numeric(12, 2),
  bedrooms smallint check (bedrooms >= 0),
  bathrooms smallint check (bathrooms >= 0),
  size_sqm numeric(10, 2) check (size_sqm >= 0),
  description text,
  additional_info text,

  status seller_lead_status_enum not null default 'NEW',
  assigned_staff uuid references public.profiles (id) on delete set null,
  follow_up_date date,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.seller_leads is
  'Public "Sell Your Property" submissions. Never auto-published as a property — admin must review and approve (section 8).';

create index ix_seller_leads_status on public.seller_leads (status);
create index ix_seller_leads_assigned on public.seller_leads (assigned_staff);

-- -----------------------------------------------------------------------
-- inquiries
-- -----------------------------------------------------------------------
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null, -- nullable: guest inquiries allowed
  property_id uuid not null references public.properties (id) on delete cascade,

  name text not null,
  email text,
  phone text,
  message text,
  inquiry_type inquiry_type_enum not null default 'CONTACT',

  status inquiry_status_enum not null default 'NEW',
  assigned_staff uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.inquiries is
  'Created whenever a customer clicks Contact/Enquire/Request Viewing on a property (section 11). Routes to Subphiphat Real Estate, never directly to the owner (section 12).';

create index ix_inquiries_property on public.inquiries (property_id);
create index ix_inquiries_status on public.inquiries (status);
create index ix_inquiries_user on public.inquiries (user_id);

-- -----------------------------------------------------------------------
-- leads (unified CRM layer)
-- -----------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),

  source_type lead_source_type_enum not null,
  inquiry_id uuid references public.inquiries (id) on delete set null,
  seller_lead_id uuid references public.seller_leads (id) on delete set null,
  matching_preference_id uuid, -- FK added in migration 7 once matching_preferences exists
  property_id uuid references public.properties (id) on delete set null,

  customer_name text,
  customer_email text,
  customer_phone text,

  lead_type lead_type_enum not null default 'GENERAL',
  status lead_status_enum not null default 'NEW',
  assigned_staff uuid references public.profiles (id) on delete set null,
  follow_up_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.leads is
  'Unified CRM work queue (section 21). Optionally links back to its source record (inquiry/seller lead/matching session) via the nullable *_id columns.';

create index ix_leads_status on public.leads (status);
create index ix_leads_assigned on public.leads (assigned_staff);
create index ix_leads_source_type on public.leads (source_type);
create index ix_leads_follow_up on public.leads (follow_up_date);

-- -----------------------------------------------------------------------
-- lead_notes
-- -----------------------------------------------------------------------
create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create index ix_lead_notes_lead on public.lead_notes (lead_id, created_at desc);

-- -----------------------------------------------------------------------
-- lead_status_history
-- -----------------------------------------------------------------------
create table public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_status lead_status_enum,
  to_status lead_status_enum not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  changed_at timestamptz not null default now()
);

create index ix_lead_status_history_lead on public.lead_status_history (lead_id, changed_at desc);

-- -----------------------------------------------------------------------
-- viewings
-- -----------------------------------------------------------------------
create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null, -- nullable: guest viewing requests allowed

  customer_name text,
  customer_phone text,
  customer_email text,
  property_id uuid not null references public.properties (id) on delete cascade,

  preferred_date date,
  preferred_time time,
  status viewing_status_enum not null default 'REQUESTED',
  notes text,
  assigned_staff uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.viewings is
  'Property viewing requests (section 22).';

create index ix_viewings_property on public.viewings (property_id);
create index ix_viewings_status on public.viewings (status);
create index ix_viewings_assigned on public.viewings (assigned_staff);
