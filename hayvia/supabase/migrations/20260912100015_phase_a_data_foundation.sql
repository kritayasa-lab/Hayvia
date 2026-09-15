-- =============================================================================
-- 20260912100015_phase_a_data_foundation.sql
-- =============================================================================
-- Phase A — Data Foundation & Admin Verification.
--
-- Two real, additive gaps found while auditing the existing Sheet <-> Supabase
-- sync path (lib/supabase/properties-sync.ts): the app's Property.location
-- (free-text address, e.g. "Thanon Niphat Uthit 3, Central Hat Yai" — distinct
-- from the structured province/city/district columns, which don't carry that
-- level of detail) and Property.contactType (still displayed publicly on the
-- property detail page's "Preferred contact" field) have no home in the
-- `properties` table at all today, so both are silently dropped every time a
-- property is synced from Sheets/demo data into Supabase. Both are required
-- to actually "preserve location" / display contact preference once Supabase
-- becomes the public read source (see lib/properties-source.ts in this same
-- pass) — this migration adds them, purely additively, nothing removed.
--
-- Also broadens public_properties' visibility to match the site's ACTUAL
-- existing public behavior. The Sheets-sourced pipeline (mapSheetRowToProperty
-- in lib/properties-source.ts) has only ever excluded "hidden" rows — a
-- "reserved" or "rented" property is still shown publicly today (with a
-- status badge on the detail page). The view created in migration 10 was
-- narrower than that (PUBLISHED only), which was fine while nothing public
-- actually read from it — but as of this pass the public site DOES read from
-- it, so it needs to match real existing behavior, not silently hide
-- reserved/rented listings that have always been visible via Sheets. SOLD and
-- every pre-publish/administrative status (DRAFT, PENDING_REVIEW, HIDDEN,
-- ARCHIVED) remain excluded — SOLD has no equivalent in the site's existing
-- 3-value status model (available/reserved/rented) and showing an actually-
-- sold property publicly, mislabeled as any of those three, would be wrong.
-- =============================================================================

alter table public.properties
  add column location text,
  add column contact_type text check (contact_type is null or contact_type in ('WhatsApp', 'LINE', 'Email'));

comment on column public.properties.location is
  'Free-text address/location line (e.g. "Thanon Niphat Uthit 3, Central Hat Yai") — distinct from the structured province/city/district/subdistrict columns, which don''t carry this level of detail. Sourced from the Sheet''s "Location" column.';

comment on column public.properties.contact_type is
  'Preferred contact method (WhatsApp/LINE/Email) shown on the public property detail page. Sourced from the Sheet''s "Contact Type" column.';

-- Appending columns at the end of a view via CREATE OR REPLACE VIEW is safe
-- (Postgres only forbids removing/reordering existing columns) — every
-- column above this line is identical to migration 14's definition, with the
-- status filter broadened as explained above.
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
  contact_type
from public.properties
where status in ('PUBLISHED', 'RESERVED', 'RENTED');

comment on view public.public_properties is
  'The ONLY property data source the public website should query. Excludes every private field (owner/agent/source/commission/private_notes) and every non-public status (DRAFT/PENDING_REVIEW/HIDDEN/ARCHIVED/SOLD). PUBLISHED/RESERVED/RENTED are all publicly visible, matching the site''s existing Sheets-sourced behavior (only "hidden" rows were ever excluded there).';
