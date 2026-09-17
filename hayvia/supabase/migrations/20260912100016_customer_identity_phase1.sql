-- =============================================================================
-- 20260912100016_customer_identity_phase1.sql
-- =============================================================================
-- Customer Identity Foundation — Phase 1 (schema only).
--
-- Introduces `customers` as the CRM's unified identity: one row can
-- represent a real person regardless of whether they've shown up as a
-- buyer/renter (leads/inquiries/viewings), a seller (seller_leads), or a
-- Get Matched user (matching_preferences) — without requiring them to ever
-- log in. `profiles`/`auth.users` remain exactly what they were: "who can
-- authenticate." `customers` is deliberately independent of that — a row
-- can exist forever with `profile_id = null` for a pure guest, and only
-- gets linked once/if that person authenticates by any means (nothing
-- currently does — email/phone OTP for customers doesn't exist yet). See
-- the Customer Identity design report for the full architecture; this
-- migration implements only the approved Phase 1 schema.
--
-- Explicitly NOT in this migration/phase:
--   - No existing form/route is changed to populate customer_id (Phase 2).
--   - No customer login, email OTP, or phone OTP.
--   - No data backfill of existing leads/inquiries/viewings/seller_leads/
--     matching_preferences rows.
--   - No change to any existing table's existing columns — every current
--     name/email/phone field on those five tables is untouched; the
--     originally-submitted contact info is preserved regardless of what
--     customer resolution later concludes.
--   - Does not touch `owners` (private, staff-curated property-owner
--     records — a separate concept from public guest identity).
-- =============================================================================

-- -----------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),

  -- Optional, one-way link to an authenticated identity. Nullable and
  -- unique: a customer starts (and may stay forever) as a pure guest with
  -- profile_id = null; it's set once/if this person authenticates. ON
  -- DELETE SET NULL, never CASCADE — deleting an auth account must never
  -- delete this person's CRM history.
  profile_id uuid unique references public.profiles (id) on delete set null,

  full_name text,

  -- Stored already normalized (trim + lower) by findOrCreateCustomer() in
  -- lib/customers/identity.ts. No separate raw-email column — unlike
  -- phone, email has no meaningful display-vs-match distinction to keep.
  email text,

  -- `phone` is as-entered (display); `phone_e164` is normalized via the
  -- EXISTING lib/auth/phone.ts normalizeToE164() — no second phone
  -- normalization implementation.
  phone text,
  phone_e164 text,

  phone_verified boolean not null default false,
  phone_verified_at timestamptz,
  email_verified boolean not null default false,

  -- How this customer was first created — e.g. 'INQUIRY' | 'VIEWING' |
  -- 'MATCHING' | 'SELLER_LEAD' | 'ACCOUNT'. Free text, not an enum: purely
  -- informational for reporting, never branched on by application logic.
  first_seen_source text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is
  'Unified CRM identity — one row per real person, independent of whether they ever authenticate. Phase 1: schema only, not yet wired to any form.';

-- Partial unique indexes: NULLs are unrestricted (a guest may have only a
-- phone, only an email, or eventually neither until contact info is
-- known), but a non-null email/phone_e164 must be unique across customers.
-- This is the constraint findOrCreateCustomer() relies on to stay
-- conflict-safe under concurrent submissions.
create unique index ux_customers_email on public.customers (email) where email is not null;
create unique index ux_customers_phone_e164 on public.customers (phone_e164) where phone_e164 is not null;

create index ix_customers_first_seen_source on public.customers (first_seen_source);

-- -----------------------------------------------------------------------
-- customer_id — nullable link from every guest-facing CRM table. Never
-- NOT NULL: Phase 1 adds the column only, a later phase wires the actual
-- write paths to populate it.
-- -----------------------------------------------------------------------
alter table public.leads
  add column customer_id uuid references public.customers (id) on delete set null;
create index ix_leads_customer on public.leads (customer_id);

alter table public.inquiries
  add column customer_id uuid references public.customers (id) on delete set null;
create index ix_inquiries_customer on public.inquiries (customer_id);

alter table public.viewings
  add column customer_id uuid references public.customers (id) on delete set null;
create index ix_viewings_customer on public.viewings (customer_id);

alter table public.seller_leads
  add column customer_id uuid references public.customers (id) on delete set null;
create index ix_seller_leads_customer on public.seller_leads (customer_id);

alter table public.matching_preferences
  add column customer_id uuid references public.customers (id) on delete set null;
create index ix_matching_preferences_customer on public.matching_preferences (customer_id);

-- -----------------------------------------------------------------------
-- updated_at trigger — reuses the shared public.set_updated_at() function
-- already defined in 20260912100009_updated_at_triggers.sql. Not
-- redefining the function, just attaching one more trigger to it.
-- -----------------------------------------------------------------------
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------
-- RLS — customers contains PII (name/email/phone). Same treatment as
-- owners/agents/admin_users/audit_logs/backup_logs (migrations 10/11):
-- RLS enabled with zero policies (deny-all for anon/authenticated by
-- Postgres default), PLUS an explicit REVOKE ALL as defense-in-depth
-- beyond RLS alone — so a single future accidental permissive policy
-- isn't enough on its own to expose this table. Reachable only via the
-- service-role key, server-side, same as every other admin-only table and
-- every existing lib/admin/* code path already relies on. No public view
-- and no public API exposes any column here.
-- -----------------------------------------------------------------------
alter table public.customers enable row level security;
revoke all on public.customers from anon, authenticated;
