-- =============================================================================
-- 20260912100014_admin_dashboard.sql
-- =============================================================================
-- Admin dashboard pass. Reuses every existing table as-is — properties,
-- owners, agents, locations, inquiries, viewings, leads, seller_leads,
-- matching_preferences/results/weights, audit_logs are all managed by the
-- new /admin UI without any schema change. This migration only adds the two
-- things that genuinely don't exist yet:
--
-- 1. `properties.price_reduced` — the admin brief explicitly asks for a
--    "Mark Price Reduced" toggle, and no existing column represents this
--    (only `featured`/`verified` exist). Purely additive, defaults false.
-- 2. `news_articles` — the admin brief asks for a News & Guides CMS
--    (title/slug/cover/category/content/draft-published/SEO fields). The
--    public /guide pages currently read from the static data/guides.ts file
--    (see that file's header) — there is no database table for this at all
--    today, so a new table is the only option, not a duplicate of anything.
--
-- All admin reads/writes route through the service-role client
-- (lib/supabase/admin.ts) from server-only code that has already verified
-- the caller's session has profiles.role = 'ADMIN' (see lib/auth/admin.ts) —
-- the same pattern already used by /api/inquiries and /api/viewings for
-- guest writes. This deliberately mirrors that established pattern instead
-- of introducing a second, untested authorization mechanism (a parallel
-- set of auth.uid()-based "is admin" RLS policies across a dozen tables,
-- which DATABASE_SCHEMA.md explicitly deferred to a later phase precisely
-- because shipping untested authorization logic is risky). The public-read
-- policy added below for news_articles is the one exception, since it's a
-- brand new table that also needs to be safely readable by anon visitors.
-- =============================================================================


-- =============================================================================
-- 1. properties.price_reduced
-- =============================================================================
alter table public.properties
  add column price_reduced boolean not null default false;

comment on column public.properties.price_reduced is
  'Admin-set "Price Reduced" flag, shown as a badge in the admin properties list. Not yet surfaced on the public site in this pass.';

-- Appending a column at the end of a view via CREATE OR REPLACE VIEW is safe
-- (Postgres only forbids removing/reordering existing columns) — every
-- column above this line is identical to the migration 10 definition.
create or replace view public.public_properties as
select
  id,
  listing_type,
  status,
  title,
  slug,
  property_type,
  description,
  price,
  currency,
  rental_period,
  bedrooms,
  bathrooms,
  size_sqm,
  furnished,
  parking,
  wifi,
  available_date,
  minimum_rental,
  deposit,
  country,
  province,
  city,
  district,
  subdistrict,
  location_id,
  latitude,
  longitude,
  google_maps_url,
  verified,
  featured,
  view_count,
  created_at,
  updated_at,
  price_reduced
from public.properties
where status = 'PUBLISHED';

comment on view public.public_properties is
  'The ONLY property data source the public website should query. Excludes every private field (owner/agent/source/commission/private_notes) and every non-PUBLISHED row.';


-- =============================================================================
-- 2. news_articles (News & Guides CMS)
-- =============================================================================
create type news_status_enum as enum (
  'DRAFT',
  'PUBLISHED'
);

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  slug text not null unique,
  cover_image_url text,
  category text,
  content text not null default '',

  status news_status_enum not null default 'DRAFT',
  published_at timestamptz,

  seo_title text,
  seo_description text,

  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.news_articles is
  'News & Guides CMS (admin-managed). Public /guide pages read PUBLISHED rows here, falling back to the static data/guides.ts demo content when this table has none — same fallback pattern as lib/properties-source.ts for Google Sheets.';

create index ix_news_articles_status on public.news_articles (status);
create index ix_news_articles_published_at on public.news_articles (published_at desc);

create trigger trg_news_articles_updated_at
  before update on public.news_articles
  for each row execute function public.set_updated_at();

alter table public.news_articles enable row level security;

-- Public, auth-independent read — same style as the migration 10 policies
-- for locations/amenities. No private columns on this table, so a plain
-- row-filtered policy (rather than a separate view like public_properties)
-- is sufficient: a DRAFT row is simply invisible to anon/authenticated.
create policy "Public can view published news articles"
  on public.news_articles for select
  using (status = 'PUBLISHED');

revoke all on public.news_articles from anon, authenticated;
grant select on public.news_articles to anon, authenticated;
-- INSERT/UPDATE/DELETE are intentionally granted to nobody but service_role
-- (server-side admin code only, after an explicit profiles.role = 'ADMIN'
-- check) — same as every admin-only write path elsewhere in this schema.
