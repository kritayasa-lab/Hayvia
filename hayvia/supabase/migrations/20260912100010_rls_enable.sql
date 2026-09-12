-- =============================================================================
-- 20260912100010_rls_enable.sql
-- =============================================================================
-- Enables Row Level Security on every table so nothing is readable/writable
-- by anon/authenticated roles until an explicit policy allows it (Postgres
-- RLS defaults to deny-all once enabled, for roles that aren't the table
-- owner and don't have BYPASSRLS — the service_role key used server-side
-- bypasses RLS entirely, which is intentional and how Phase 4's migration
-- script / Phase 10's admin APIs will work).
--
-- IMPORTANT — this migration only adds policies that do NOT depend on
-- auth.uid() (public lookup data, and published-property visibility). Every
-- policy that needs to know "is this the current user's own row" (own
-- profile, own favorites, own inquiries, admin/staff role checks, etc.) is
-- explicitly deferred to Phase 11, since that requires Supabase Auth to
-- exist first (Phase 3) — building those policies now would mean writing
-- and shipping untested authorization logic. Until Phase 11, the
-- application can only read/write the tables below via the service_role
-- key, server-side only, never in the browser (section 23).
--
-- COLUMN-LEVEL PRIVACY NOTE (sections 12/30): RLS controls which ROWS a
-- role can see, not which COLUMNS. Hiding owner/agent/source/commission
-- data on an otherwise-public property row is handled with a dedicated
-- `public_properties` VIEW (below) that simply omits those columns — the
-- Next.js data layer should query this view for any public-facing request,
-- never the raw `properties` table.
-- =============================================================================

-- -----------------------------------------------------------------------
-- Enable RLS on every table.
-- -----------------------------------------------------------------------
alter table public.locations enable row level security;
alter table public.amenities enable row level security;
alter table public.owners enable row level security;
alter table public.agents enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.property_amenities enable row level security;
alter table public.seller_leads enable row level security;
alter table public.inquiries enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_status_history enable row level security;
alter table public.viewings enable row level security;
alter table public.favorites enable row level security;
alter table public.property_views enable row level security;
alter table public.matching_preferences enable row level security;
alter table public.matching_results enable row level security;
alter table public.matching_weights enable row level security;
alter table public.audit_logs enable row level security;
alter table public.backup_logs enable row level security;

-- -----------------------------------------------------------------------
-- Public, auth-independent read policies.
-- -----------------------------------------------------------------------

-- Locations and amenities are pure lookup data — always public.
create policy "Public can view active locations"
  on public.locations for select
  using (is_active = true);

create policy "Public can view amenities"
  on public.amenities for select
  using (true);

-- property_images / property_amenities contain no private data themselves;
-- the only thing that matters is whether the parent property is published.
create policy "Public can view images of published properties"
  on public.property_images for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_images.property_id and p.status = 'PUBLISHED'
    )
  );

create policy "Public can view amenities of published properties"
  on public.property_amenities for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_amenities.property_id and p.status = 'PUBLISHED'
    )
  );

-- No public policy is added directly on public.properties. Instead:
revoke all on public.properties from anon, authenticated;

-- -----------------------------------------------------------------------
-- public_properties — the column-safe view for all public-facing reads.
-- Deliberately excludes: owner_id, agent_id, source, source_url,
-- commission_type, commission_value, private_notes, created_by, updated_by,
-- external_ref, legacy_amenities_raw.
--
-- Created without `security_invoker`, so it runs with the view owner's
-- table privileges rather than the querying role's — this is what lets
-- anon/authenticated read through it even though they have zero direct
-- grants on the underlying properties table.
-- -----------------------------------------------------------------------
create view public.public_properties as
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
  updated_at
from public.properties
where status = 'PUBLISHED';

comment on view public.public_properties is
  'The ONLY property data source the public website should query. Excludes every private field (owner/agent/source/commission/private_notes) and every non-PUBLISHED row.';

grant select on public.public_properties to anon, authenticated;

-- -----------------------------------------------------------------------
-- Everything else below gets RLS enabled above with NO policy yet, which
-- means: fully inaccessible to anon/authenticated until Phase 11. Listed
-- here explicitly so it's clear this is intentional, not an oversight:
--
--   owners, agents                     -> admin/staff only (Phase 11)
--   profiles, admin_users               -> own row / admin only (Phase 11)
--   seller_leads, inquiries             -> own row (if user_id set) / admin (Phase 11)
--   leads, lead_notes, lead_status_history, viewings -> admin/staff only (Phase 11)
--   favorites, property_views           -> own row only (Phase 11)
--   matching_preferences, matching_results -> own row (if user_id set) / admin (Phase 11)
--   matching_weights                    -> admin only, public read arguably fine
--                                          later (weights aren't sensitive) but
--                                          deferred for consistency
--   audit_logs, backup_logs             -> admin only (Phase 11)
-- -----------------------------------------------------------------------
