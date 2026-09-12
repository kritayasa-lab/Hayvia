-- =============================================================================
-- 20260912100003_profiles_and_admin_users.sql
-- =============================================================================
-- profiles (section 9/10) + admin_users (section 5/18).
--
-- NOTE: this migration creates the TABLES and the standard Supabase
-- new-user-sync trigger only. It does NOT implement the OTP verification
-- flow, login/signup pages, or auth-dependent RLS policies — that's Phase 3,
-- which you've asked me not to start yet. The trigger below is pure schema
-- plumbing (it just keeps public.profiles in sync with auth.users) and is
-- safe/standard to have in place from the start.
-- =============================================================================

-- -----------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------
-- Shares its primary key with auth.users(id) — a true 1:1 extension table.
-- email/phone are mirrored from auth.users for convenient querying from
-- application code that can't (and shouldn't) query the auth schema
-- directly; they're kept in sync by the trigger below.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text unique,
  phone text,
  phone_verified boolean not null default false,
  phone_verified_at timestamptz,
  role user_role_enum not null default 'USER',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public-schema 1:1 extension of auth.users. A user is not a fully verified customer until phone_verified = true (section 9).';

create index ix_profiles_role on public.profiles (role);
create index ix_profiles_phone on public.profiles (phone);

-- Now that profiles exists, backfill the FKs deferred from migration 2.
alter table public.owners
  add constraint fk_owners_created_by foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.agents
  add constraint fk_agents_created_by foreign key (created_by) references public.profiles (id) on delete set null;

-- -----------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth.users row is created.
-- Standard Supabase pattern — without this, a signed-up user would have no
-- corresponding public.profiles row until the app explicitly created one,
-- which is fragile. `security definer` lets this function (owned by a
-- privileged role) insert into public.profiles despite RLS.
-- -----------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------
-- admin_users — extension table for staff/admin-specific metadata.
-- One row per profile whose role is ADMIN / STAFF / AGENT. Kept separate
-- from `profiles` so customer-facing profile data doesn't get cluttered
-- with internal HR/access fields, and so admin-only queries don't need to
-- filter the whole profiles table.
-- -----------------------------------------------------------------------
create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  employee_code text,
  department text,
  access_level text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Staff/admin-only metadata, 1:1 with profiles for users whose role is ADMIN/STAFF/AGENT (section 18).';

create index ix_admin_users_is_active on public.admin_users (is_active);
