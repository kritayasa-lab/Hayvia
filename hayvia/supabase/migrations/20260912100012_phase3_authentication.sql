-- =============================================================================
-- 20260912100012_phase3_authentication.sql
-- =============================================================================
-- Phase 3 — Supabase Authentication. New migration, per instructions —
-- migrations 1-11 are untouched.
--
-- This migration does NOT create any OTP/verification-code storage. Supabase
-- Auth owns all of that internally (auth.users, auth.identities, and its own
-- internal OTP/session machinery) — this migration only keeps public.profiles
-- in sync with what Supabase Auth already knows, and adds the RLS/role rules
-- needed now that real authenticated users exist.
-- =============================================================================


-- =============================================================================
-- 1. Email verification symmetry (profiles already had phone_verified)
-- =============================================================================
alter table public.profiles
  add column email_verified boolean not null default false,
  add column email_verified_at timestamptz;

comment on column public.profiles.email_verified is
  'Mirrors auth.users.email_confirmed_at IS NOT NULL. Kept in sync by handle_new_auth_user()/handle_auth_user_update() below — never set directly by application code.';


-- =============================================================================
-- 2. profiles.phone uniqueness
-- =============================================================================
-- auth.users already enforces phone uniqueness at the Supabase Auth level
-- when phone auth is enabled. Mirroring that constraint on the denormalized
-- profiles.phone column keeps the two in lockstep and catches any drift
-- early rather than silently. NULLs remain unrestricted (a user with no
-- phone yet), which is the correct behavior for phone-less email signups.
-- =============================================================================
alter table public.profiles
  add constraint uq_profiles_phone unique (phone);


-- =============================================================================
-- 3. handle_new_auth_user() — extended to seed verification state correctly
-- =============================================================================
-- Same trigger from migration 3, `create or replace`'d (not redefined from
-- scratch) to also populate phone_verified/email_verified at creation time
-- from auth.users' own confirmation timestamps, instead of always inserting
-- false/null regardless of actual state.
-- =============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, email, phone,
    phone_verified, phone_verified_at,
    email_verified, email_verified_at
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.phone,
    new.phone_confirmed_at is not null, new.phone_confirmed_at,
    new.email_confirmed_at is not null, new.email_confirmed_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- =============================================================================
-- 4. handle_auth_user_update() — NEW. Keeps profiles in sync after signup.
-- =============================================================================
-- This is the piece Phase 2 was missing entirely. Fires whenever
-- auth.users changes, which happens on:
--   - phone OTP verification completing (phone_confirmed_at gets set)
--   - email confirmation link being clicked (email_confirmed_at gets set)
--   - a user linking a SECOND identifier to their EXISTING account via
--     supabase.auth.updateUser({ phone }) or updateUser({ email }) — this
--     is the mechanism that prevents duplicate profiles (see section 5 and
--     the chat report for the full identity-architecture explanation): it
--     updates the same auth.users row rather than creating a new one, so
--     this trigger syncs the added identifier into the SAME profiles row.
-- =============================================================================
create or replace function public.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    email = new.email,
    phone = new.phone,
    phone_verified = new.phone_confirmed_at is not null,
    phone_verified_at = new.phone_confirmed_at,
    email_verified = new.email_confirmed_at is not null,
    email_verified_at = new.email_confirmed_at
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_update();


-- =============================================================================
-- 5. Prevent self-modification of system-managed profile fields
-- =============================================================================
-- A user can update their own profile (full_name, avatar_url, etc. — see
-- the RLS policy below) but must never be able to change `role` directly,
-- NOR `phone_verified`/`phone_verified_at`/`email_verified`/`email_verified_at`
-- — those four are supposed to be pure mirrors of auth.users, and without
-- this guard a client could call
-- `supabase.from('profiles').update({ phone_verified: true })` directly and
-- self-verify. The RLS policy below only restricts which ROW can be
-- updated (auth.uid() = id) — it says nothing about which COLUMNS, so this
-- trigger is the actual enforcement for those five fields.
--
-- The tricky part: handle_auth_user_update() (section 4 above) legitimately
-- NEEDS to write these same fields when auth.users changes. We distinguish
-- "our own trusted cascade" from "a direct client UPDATE" using
-- pg_trigger_depth(): when handle_auth_user_update() (itself firing as a
-- trigger on auth.users) performs its UPDATE on profiles, this trigger
-- fires from WITHIN that outer trigger's execution, so
-- pg_trigger_depth() > 1. A direct client-issued `UPDATE profiles ...`
-- hits this trigger as the outermost/only trigger in play, so
-- pg_trigger_depth() = 1. This is more reliable than checking auth.role()
-- alone, since Supabase Auth's own backend (GoTrue) may update auth.users
-- through a database session that doesn't carry the original request's JWT
-- role claim — pg_trigger_depth() doesn't depend on that at all.
-- service_role is still always allowed through directly, for whenever
-- Phase 10/11 admin tooling needs to correct one of these fields by hand.
-- =============================================================================
create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 or auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'You are not allowed to change your own role.';
  end if;

  if new.phone_verified is distinct from old.phone_verified
     or new.phone_verified_at is distinct from old.phone_verified_at then
    raise exception 'phone_verified is managed automatically and cannot be changed directly.';
  end if;

  if new.email_verified is distinct from old.email_verified
     or new.email_verified_at is distinct from old.email_verified_at then
    raise exception 'email_verified is managed automatically and cannot be changed directly.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_role_self_update on public.profiles;
drop trigger if exists trg_protect_profile_system_fields on public.profiles;
create trigger trg_protect_profile_system_fields
  before update on public.profiles
  for each row execute function public.protect_profile_system_fields();


-- =============================================================================
-- 6. Own-profile RLS policies
-- =============================================================================
-- No INSERT policy: rows are only ever created by handle_new_auth_user()
-- (SECURITY DEFINER, bypasses RLS) — a user should never be able to insert
-- an arbitrary profiles row themselves.
-- No DELETE policy: account deletion isn't in scope for this phase.
-- Admin/staff access to OTHER users' profiles is intentionally deferred —
-- that's Phase 10/11 (Admin Dashboard), explicitly out of scope now.
-- =============================================================================
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- =============================================================================
-- 7. No change to admin/private property data access
-- =============================================================================
-- owners, agents, admin_users, audit_logs, backup_logs, and the raw
-- properties table remain exactly as locked down in migrations 2/4/10/11 —
-- fully inaccessible to anon/authenticated. A profiles.role of 'ADMIN' does
-- NOT, by itself, grant any additional table access yet; role-based admin
-- policies are Phase 10/11 work. This migration deliberately does not add
-- any role-based access to those tables.
-- =============================================================================
