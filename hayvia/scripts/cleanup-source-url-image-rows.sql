-- =============================================================================
-- scripts/cleanup-source-url-image-rows.sql
-- =============================================================================
-- ONE-OFF MANUAL CLEANUP — NOT a migration. Nothing in this repo runs this
-- file automatically; it exists only to be reviewed and pasted into the
-- Supabase SQL Editor by hand.
--
-- Fixes bad property_images rows created by a bug where an AI-imported
-- property's own `source_url` (the Facebook/listing page link — never an
-- image) was mistakenly submitted through the "Add Image by URL" control,
-- inserting the listing page's own URL as if it were a photo. The
-- server-side guard that now prevents this going forward lives in
-- addPropertyImage() (app/admin/(dashboard)/properties/actions.ts) — this
-- script only cleans up rows that were already created before that guard
-- existed.
--
-- IDENTIFICATION CRITERIA (both must hold — matches the guard's own logic):
--   1. property_images.url is an EXACT match for that same row's
--      properties.source_url.
--   2. That url does NOT end in a normal image extension
--      (.jpg/.jpeg/.png/.gif/.webp/.avif/.bmp/.svg, optionally followed by
--      a query string/fragment) — so a source_url that genuinely IS a
--      direct image link is left alone.
--
-- Deliberately does NOT touch any other property_images row, even a
-- clearly-broken one, if it doesn't match both conditions above — this is
-- not a general "clean up bad images" pass.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1 — REVIEW ONLY. Run this first and read every row before running the
-- DELETE below. Nothing is changed by this step.
-- -----------------------------------------------------------------------------
select
  pi.id            as property_image_id,
  pi.property_id,
  p.title          as property_title,
  p.source         as property_source,
  pi.url           as bad_image_url,
  p.source_url,
  pi.created_at
from public.property_images pi
join public.properties p on p.id = pi.property_id
where pi.url = p.source_url
  and p.source_url is not null
  and pi.url !~* '\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$'
order by pi.created_at desc;

-- -----------------------------------------------------------------------------
-- STEP 2 — DESTRUCTIVE. Only run after reviewing STEP 1's output and
-- confirming every listed row is genuinely the listing-page URL, not a
-- real photo. Deletes ONLY rows matching both identification criteria
-- above — nothing else in property_images is touched.
-- -----------------------------------------------------------------------------
delete from public.property_images pi
using public.properties p
where pi.property_id = p.id
  and pi.url = p.source_url
  and p.source_url is not null
  and pi.url !~* '\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$';
