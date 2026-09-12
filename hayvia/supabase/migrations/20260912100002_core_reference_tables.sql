-- =============================================================================
-- 20260912100002_core_reference_tables.sql
-- =============================================================================
-- locations (section 6), amenities lookup, owners + agents (section 13).
--
-- These have no dependency on auth.users, so they're created early.
-- =============================================================================

-- -----------------------------------------------------------------------
-- locations
-- -----------------------------------------------------------------------
-- A structured, hierarchical reference table so the site can expand to new
-- Thai provinces/cities without any schema change (section 6). Properties do
-- NOT require a location_id (they store their own country/province/city/
-- district/subdistrict directly for fast, join-free reads — see migration 4)
-- but MAY optionally link here via properties.location_id for SEO location
-- pages (e.g. /rent/hat-yai) and consistent dropdown data.
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  country text not null default 'Thailand',
  province text not null,
  city text not null,
  district text,
  subdistrict text,
  slug text not null unique,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.locations is
  'Hierarchical Thailand location reference (country > province > city > district > subdistrict). Public, read-only from the client.';

-- Prevents duplicate hierarchy rows. COALESCE handles nullable district/subdistrict
-- (NULL <> NULL in a normal unique constraint, so we normalize to empty string).
create unique index ux_locations_hierarchy
  on public.locations (country, province, city, coalesce(district, ''), coalesce(subdistrict, ''));

create index ix_locations_province on public.locations (province);
create index ix_locations_city on public.locations (city);
create index ix_locations_is_active on public.locations (is_active);

-- -----------------------------------------------------------------------
-- amenities (lookup) + property_amenities (junction, created in migration 4
-- once the properties table exists)
-- -----------------------------------------------------------------------
create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  icon text,
  created_at timestamptz not null default now()
);

comment on table public.amenities is
  'Lookup table of reusable amenity tags (e.g. "Swimming pool", "Fitness room"). Public, read-only from the client.';

-- -----------------------------------------------------------------------
-- owners — PRIVATE. Never exposed through public API responses (section 12).
-- -----------------------------------------------------------------------
create table public.owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  line_id text,
  whatsapp text,
  notes text,
  source text,
  source_url text,
  default_commission_type commission_type_enum,
  default_commission_value numeric(12, 2),
  status owner_status_enum not null default 'ACTIVE',
  created_by uuid, -- FK to profiles(id) added in migration 3 (profiles doesn't exist yet)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.owners is
  'PRIVATE: property owner contact + commission info. Admin/staff only — never returned by public APIs (section 12/13).';

create index ix_owners_status on public.owners (status);

-- -----------------------------------------------------------------------
-- agents — PRIVATE contact details, same protection as owners.
-- -----------------------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  line_id text,
  whatsapp text,
  agency_name text,
  license_number text,
  commission_split_percent numeric(5, 2),
  notes text,
  status agent_status_enum not null default 'ACTIVE',
  created_by uuid, -- FK to profiles(id) added in migration 3
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agents is
  'PRIVATE: agent contact + commission info. Admin/staff only — never returned by public APIs (section 12/13).';

create index ix_agents_status on public.agents (status);
