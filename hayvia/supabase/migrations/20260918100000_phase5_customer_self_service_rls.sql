-- =============================================================================
-- 20260918100000_phase5_customer_self_service_rls.sql
-- =============================================================================
-- Phase 5 — Customer Email OTP/Magic Link: the minimum RLS needed for an
-- authenticated customer to read exactly their own data through /account.
--
-- No new tables, no new identity system. Reuses `customers.profile_id`,
-- already introduced by the Phase 1 Customer Identity migration
-- (20260912100016) as the one-way link from an authenticated
-- `auth.users`/`profiles` row to its `customers` business-identity row.
-- This migration only adds SELECT policies scoped to `profile_id =
-- auth.uid()` on `customers`, and to
-- `customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid())`
-- on the three history tables a customer's /account page reads. No write
-- policies (no self-service profile editing in Phase 5). Admin/service-role
-- access is untouched — it bypasses RLS entirely, exactly as before.
-- =============================================================================

-- -----------------------------------------------------------------------
-- customers — table-level grants for anon/authenticated were explicitly
-- revoked in the Phase 1 migration (defense in depth, same treatment as
-- owners/agents/admin_users/audit_logs/backup_logs). SELECT must be
-- re-granted here for an authenticated customer to reach their own row at
-- all; the policy below is what actually narrows that access to exactly
-- one row. No INSERT/UPDATE/DELETE grant or policy is added — writes to
-- `customers` remain service-role-only (findOrCreateCustomer() and the
-- Phase 5 auth-linking step), exactly as today.
-- -----------------------------------------------------------------------
grant select on public.customers to authenticated;

create policy "Customers can view own customer row"
  on public.customers for select
  using (profile_id = auth.uid());

-- -----------------------------------------------------------------------
-- inquiries / viewings / matching_preferences — never had their default
-- Supabase-bootstrap grants explicitly revoked (unlike customers), but
-- granting SELECT explicitly here too, matching the Phase 2 correction
-- migration's own stated philosophy: an explicit, self-documenting grant
-- rather than relying on undocumented platform defaults.
--
-- The subquery below re-runs customers' own new SELECT policy for the
-- calling role, which only ever narrows it to auth.uid()'s single row —
-- this is the standard, non-recursive "owns via foreign key" RLS pattern
-- (the referenced policy is on a different table, so there's no cycle).
-- -----------------------------------------------------------------------
grant select on public.inquiries to authenticated;
grant select on public.viewings to authenticated;
grant select on public.matching_preferences to authenticated;

create policy "Customers can view own inquiries"
  on public.inquiries for select
  using (customer_id in (select id from public.customers where profile_id = auth.uid()));

create policy "Customers can view own viewings"
  on public.viewings for select
  using (customer_id in (select id from public.customers where profile_id = auth.uid()));

create policy "Customers can view own matching_preferences"
  on public.matching_preferences for select
  using (customer_id in (select id from public.customers where profile_id = auth.uid()));

-- -----------------------------------------------------------------------
-- Explicitly NOT touched by this migration: seller_leads, leads,
-- lead_notes, lead_status_history (no customer-facing read need in Phase
-- 5 — /account's history is inquiries/viewings/matching only, per the
-- Phase 5 spec), owners, agents, admin_users, audit_logs, backup_logs, the
-- raw properties table, and every admin-only policy/grant from prior
-- migrations. Admin/staff access and public guest write paths are
-- unaffected — this migration adds read access for one new role scenario
-- (an authenticated customer reading their own rows) and nothing else.
-- -----------------------------------------------------------------------
