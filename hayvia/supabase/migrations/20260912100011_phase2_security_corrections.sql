-- =============================================================================
-- 20260912100011_phase2_security_corrections.sql
-- =============================================================================
-- Phase 2 correction pass, applied as a NEW migration rather than editing
-- migrations 1-10 in place — once a migration has been applied to any
-- database (even a dev one), rewriting its history is bad practice; a
-- corrective migration keeps an honest audit trail of what was wrong and
-- what changed. See the chat report for the full "why" on each item below;
-- comments here summarize the reasoning inline.
-- =============================================================================


-- =============================================================================
-- 1. FIX: property_images / property_amenities public read policies
-- =============================================================================
-- THE BUG: the policies added in migration 10 checked property status with a
-- raw `exists (select 1 from public.properties ...)` inside the USING
-- clause. That subquery runs AS THE QUERYING ROLE (anon/authenticated) — it
-- does NOT get the "view owner" privilege trick that public_properties
-- uses. Since properties has RLS enabled with no policy for anon at all,
-- and direct grants on properties were revoked, that subquery either always
-- returns zero rows or fails outright with "permission denied for table
-- properties" — meaning images/amenities for genuinely PUBLISHED properties
-- were unreachable, not just over-exposed. This is the standard Postgres/
-- Supabase pattern for this exact problem: a SECURITY DEFINER function,
-- owned by the migration-running role (which owns `properties` and
-- therefore bypasses its own RLS by default), so the function can check any
-- property's status regardless of the caller's grants or RLS visibility.
-- Only a boolean is exposed via EXECUTE — never row data.
-- =============================================================================

create or replace function public.is_property_published(p_property_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.properties
    where id = p_property_id and status = 'PUBLISHED'
  );
$$;

comment on function public.is_property_published(uuid) is
  'SECURITY DEFINER helper so RLS policies on child tables (property_images, property_amenities) can check a property''s status without needing SELECT on the properties table itself. Returns only a boolean — never exposes row data.';

grant execute on function public.is_property_published(uuid) to anon, authenticated;

drop policy if exists "Public can view images of published properties" on public.property_images;
create policy "Public can view images of published properties"
  on public.property_images for select
  using (public.is_property_published(property_id));

drop policy if exists "Public can view amenities of published properties" on public.property_amenities;
create policy "Public can view amenities of published properties"
  on public.property_amenities for select
  using (public.is_property_published(property_id));


-- =============================================================================
-- 2. Explicit grants for all public-facing property-related tables/views
-- =============================================================================
-- WHY: Supabase's default project bootstrap grants anon/authenticated broad
-- default privileges on new public-schema tables, relying on RLS alone as
-- the gatekeeper. That's fine, but it means this schema's actual public
-- surface area was implicit rather than explicit. For every table that IS
-- meant to be publicly readable, we now grant SELECT explicitly (and
-- nothing else) so the schema is correct and self-documenting regardless of
-- platform defaults. (public_properties already has an explicit grant from
-- migration 10 — not repeated here.)
-- =============================================================================

revoke all on public.locations from anon, authenticated;
grant select on public.locations to anon, authenticated;

revoke all on public.amenities from anon, authenticated;
grant select on public.amenities to anon, authenticated;

revoke all on public.property_images from anon, authenticated;
grant select on public.property_images to anon, authenticated;

revoke all on public.property_amenities from anon, authenticated;
grant select on public.property_amenities to anon, authenticated;

-- -----------------------------------------------------------------------
-- Defense in depth for tables that must NEVER be reachable by anon/
-- authenticated, even after Phase 11 adds role-based policies for other
-- tables. Unlike e.g. favorites/inquiries (which WILL get scoped "own row"
-- policies in Phase 11), these five should stay admin/service-role-only
-- forever, so revoking table-level grants now — on top of RLS-deny — means
-- a future accidental permissive policy alone wouldn't be enough to expose
-- them; both the grant AND a policy would have to be wrong at once.
-- -----------------------------------------------------------------------
revoke all on public.owners from anon, authenticated;
revoke all on public.agents from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
revoke all on public.backup_logs from anon, authenticated;

-- properties itself was already revoked in migration 10; restated here only
-- as a comment for completeness, not re-run:
-- revoke all on public.properties from anon, authenticated; -- (already applied)


-- =============================================================================
-- 3. Add subdistrict to matching_preferences
-- =============================================================================
-- Brings matching_preferences to the same location granularity as
-- properties/locations (country > province > city > district >
-- subdistrict), so matching can score at the subdistrict level once the
-- Phase 9 engine is built.
-- =============================================================================

alter table public.matching_preferences
  add column subdistrict text;

-- Replaces no prior index (matching_preferences had no location index yet);
-- added now that the full location tuple exists, for the Phase 9 engine's
-- location-scoring queries.
create index ix_matching_preferences_location
  on public.matching_preferences (province, city, district, subdistrict);


-- =============================================================================
-- 4. leads source-relationship validation
-- =============================================================================
-- Enforced at the database level (not just application code) so the rule
-- holds regardless of which code path writes a lead — the future admin API,
-- a server-side job, or a one-off script. MANUAL/GET_MATCHED/OTHER leads are
-- allowed to have no source record, matching how they're created today (a
-- manual CRM entry, or a Get Matched submission that currently lives in
-- Google Sheets, not as a Supabase row).
--
-- NOTE: if you've already inserted `leads` rows that violate this rule
-- (e.g. an INQUIRY-sourced lead with a null inquiry_id) in a dev database,
-- this ALTER will fail until those rows are fixed — expected to be a
-- non-issue on a schema this new, but flagging it.
-- =============================================================================

alter table public.leads
  add constraint chk_leads_source_relationship check (
    (source_type = 'INQUIRY' and inquiry_id is not null)
    or (source_type = 'SELLER_LEAD' and seller_lead_id is not null)
    or (source_type = 'MATCHING' and matching_preference_id is not null)
    or (source_type in ('MANUAL', 'GET_MATCHED', 'OTHER'))
  );


-- =============================================================================
-- 5. Missing foreign-key indexes
-- =============================================================================
-- Every FK column should generally be indexed — it's needed for efficient
-- joins from the "many" side and for fast lookups when a referenced row is
-- deleted/updated (ON DELETE CASCADE/SET NULL has to find dependent rows).
-- These six were missed in the original migrations; found during this
-- review.
-- =============================================================================

create index ix_leads_inquiry on public.leads (inquiry_id);
create index ix_leads_seller_lead on public.leads (seller_lead_id);
create index ix_leads_property on public.leads (property_id);
create index ix_viewings_lead on public.viewings (lead_id);
create index ix_viewings_user on public.viewings (user_id);
create index ix_seller_leads_user on public.seller_leads (user_id);
