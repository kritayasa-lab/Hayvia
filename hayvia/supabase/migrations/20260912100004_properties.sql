-- =============================================================================
-- 20260912100004_properties.sql
-- =============================================================================
-- properties (section 7), property_images, property_amenities junction.
--
-- Field list follows section 7 closely. A few additions beyond that list are
-- called out in comments and in DATABASE_SCHEMA.md.
-- =============================================================================

create table public.properties (
  id uuid primary key default gen_random_uuid(),

  listing_type listing_type_enum not null,
  status property_status_enum not null default 'DRAFT',

  title text not null,
  slug text not null unique,
  property_type property_type_enum not null,
  description text,

  price numeric(12, 2) not null check (price >= 0),
  currency char(3) not null default 'THB',
  -- Only meaningful when listing_type = RENT. Left nullable rather than
  -- constrained, since enforcing "must be null for BUY" at the DB level
  -- would make future listing types more brittle to add.
  rental_period rental_period_enum,

  bedrooms smallint check (bedrooms >= 0), -- 0 = studio
  bathrooms smallint check (bathrooms >= 0),
  size_sqm numeric(10, 2) check (size_sqm >= 0),
  furnished furnished_enum,
  parking boolean not null default false,
  wifi boolean not null default false,

  available_date date,
  minimum_rental text, -- kept as free text (e.g. "6 months") to match legacy Sheet data fidelity
  deposit text,        -- kept as free text (e.g. "2 months rent + 1 month advance") for the same reason

  -- Denormalized location fields (fast, join-free reads on every listing
  -- page) — see locations table (migration 2) for the optional structured
  -- reference used for SEO location pages and consistent dropdown data.
  country text not null default 'Thailand',
  province text not null,
  city text not null,
  district text,
  subdistrict text,
  location_id uuid references public.locations (id) on delete set null,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  google_maps_url text,

  verified boolean not null default false,
  featured boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),

  owner_id uuid references public.owners (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,

  -- PRIVATE fields (section 12/13/30) — must NEVER be returned by any public
  -- API response or included in public metadata/sitemaps. Only admin/staff
  -- data-access functions should select these columns.
  source text,
  source_url text,
  commission_type commission_type_enum,
  commission_value numeric(12, 2),
  private_notes text,

  -- Migration/traceability support (section 29) — the original Google
  -- Sheets "ID" column, used so the Phase 4 import script can upsert
  -- idempotently via `ON CONFLICT (external_ref) DO UPDATE` instead of
  -- risking duplicate rows if the import is run more than once.
  external_ref text unique,
  legacy_amenities_raw text, -- original comma-separated Sheet string, kept temporarily for migration audit/debugging; safe to drop once property_amenities is verified

  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.properties is
  'Core listing table. Columns from "source" through "private_notes" are PRIVATE — see DATABASE_SCHEMA.md section on public vs private fields.';

create index ix_properties_listing_status on public.properties (listing_type, status);
create index ix_properties_province_city on public.properties (province, city);
create index ix_properties_property_type on public.properties (property_type);
create index ix_properties_price on public.properties (price);
create index ix_properties_owner on public.properties (owner_id);
create index ix_properties_agent on public.properties (agent_id);
create index ix_properties_featured on public.properties (featured) where featured = true;
create index ix_properties_view_count on public.properties (view_count desc);
create index ix_properties_location on public.properties (location_id);

-- -----------------------------------------------------------------------
-- property_images
-- -----------------------------------------------------------------------
create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  url text not null,
  sort_order smallint not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.property_images is
  'One row per property photo. Supports Image 1-8+ from the legacy Sheet with no fixed column limit.';

create index ix_property_images_property on public.property_images (property_id, sort_order);

-- Only one cover image per property.
create unique index ux_property_images_one_cover
  on public.property_images (property_id)
  where is_cover = true;

-- -----------------------------------------------------------------------
-- property_amenities (junction to the amenities lookup table)
-- -----------------------------------------------------------------------
create table public.property_amenities (
  property_id uuid not null references public.properties (id) on delete cascade,
  amenity_id uuid not null references public.amenities (id) on delete cascade,
  primary key (property_id, amenity_id)
);

create index ix_property_amenities_amenity on public.property_amenities (amenity_id);
