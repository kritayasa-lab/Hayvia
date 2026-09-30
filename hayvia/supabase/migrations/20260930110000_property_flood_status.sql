-- =============================================================================
-- 20260930110000_property_flood_status.sql
-- =============================================================================
-- Flood-safety classification for the Songkhla flood-safe house inventory
-- (PR B). Purely additive: one new enum type, one new column with a
-- NOT NULL DEFAULT so every existing row becomes 'UNKNOWN' automatically —
-- no backfill statement, no existing row touched or rewritten.
--
-- Set only by a human admin via the Property Form. AI Property Import
-- (lib/ai/property-import.ts) never extracts or infers this value — its
-- extraction schema has no flood-related key at all, and
-- createDraftProperty() explicitly writes 'UNKNOWN' on every imported
-- row (see app/admin/(dashboard)/properties/import/actions.ts).
--
-- No new table. No location/map table. No change to any other column.
-- =============================================================================

create type flood_status_enum as enum (
  'SAFE',
  'RISK',
  'UNKNOWN'
);

alter table public.properties
  add column flood_status flood_status_enum not null default 'UNKNOWN';

comment on column public.properties.flood_status is
  'Flood-safety classification. SAFE/RISK are set only by a human admin — never inferred from location or listing text, and never set by AI Property Import. Defaults to UNKNOWN for every existing and newly-created row (including AI-imported drafts). Used by the Songkhla flood-safe house inventory rule: province = Songkhla AND property_type = HOUSE AND status = PUBLISHED AND flood_status = SAFE.';

-- Appending a column at the end of the view is safe (Postgres only forbids
-- removing/reordering existing columns). flood_status is not a private
-- field (owner/agent/source/commission/private_notes are the only
-- excluded columns — see migration 4's table comment), so it's exposed
-- here for the future flood-safe inventory / map feature to read from the
-- same public, RLS-safe source everything else on the public site uses.
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
  price_reduced,
  location,
  contact_type,
  flood_status
from public.properties
where status in ('PUBLISHED', 'RESERVED', 'RENTED');

comment on view public.public_properties is
  'The ONLY property data source the public website should query. Excludes every private field (owner/agent/source/commission/private_notes) and every non-public status (DRAFT/PENDING_REVIEW/HIDDEN/ARCHIVED/SOLD). PUBLISHED/RESERVED/RENTED are all publicly visible, matching the site''s existing Sheets-sourced behavior (only "hidden" rows were ever excluded there).';
