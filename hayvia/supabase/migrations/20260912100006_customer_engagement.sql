-- =============================================================================
-- 20260912100006_customer_engagement.sql
-- =============================================================================
-- favorites (section 16), property_views (section 17).
-- =============================================================================

-- -----------------------------------------------------------------------
-- favorites — a natural composite key (no separate id needed): a user can
-- only favorite a given property once, which is exactly what we want.
-- -----------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

comment on table public.favorites is
  'Saved properties. Authenticated users only (section 16).';

create index ix_favorites_property on public.favorites (property_id);

-- -----------------------------------------------------------------------
-- property_views — an append-only log (unlike favorites, the same
-- user/session viewing the same property twice should create two rows), so
-- it needs a surrogate id rather than a natural key.
-- -----------------------------------------------------------------------
create table public.property_views (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  session_id text,
  viewed_at timestamptz not null default now(),
  constraint chk_property_views_identity check (user_id is not null or session_id is not null)
);

comment on table public.property_views is
  'Append-only view log for both authenticated users and anonymous visitors (section 17). properties.view_count is a fast denormalized counter kept in sync by the application/API layer, not derived from this table on every read.';

create index ix_property_views_property on public.property_views (property_id);
create index ix_property_views_user on public.property_views (user_id);
create index ix_property_views_session on public.property_views (session_id);
create index ix_property_views_viewed_at on public.property_views (viewed_at desc);
