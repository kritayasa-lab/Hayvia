-- =============================================================================
-- 20260912100013_pass2_viewing_type_and_min_size.sql
-- =============================================================================
-- Pass 2 (real matching + Supabase-backed inquiries/viewings) found two real
-- gaps against the brief while wiring up the application code:
--
-- 1. `viewings` has no structured field for viewing type (In-person vs Video
--    Call) — only free-text `notes`. The brief explicitly requires this as
--    its own field (so staff/admin can filter/report on it later), so it
--    needs a real column, not text stuffed into `notes`.
--
-- 2. `matching_preferences` has no minimum-size field, but "Minimum Size" is
--    an explicit Get Matched requirement. Every other matching_preferences
--    field it's scored against already exists — this one was simply missing.
--
-- Both are purely additive (new enum + new nullable/defaulted columns) —
-- nothing here changes existing data, constraints, or RLS on either table.
-- =============================================================================

create type viewing_type_enum as enum (
  'IN_PERSON',
  'VIDEO_CALL'
);

alter table public.viewings
  add column viewing_type viewing_type_enum not null default 'IN_PERSON';

comment on column public.viewings.viewing_type is
  'In-person viewing vs. video call, as chosen on the public viewing request form.';

alter table public.matching_preferences
  add column min_size_sqm numeric(10, 2) check (min_size_sqm is null or min_size_sqm >= 0);

comment on column public.matching_preferences.min_size_sqm is
  'Minimum property size (sqm) requested in a Get Matched run. Nullable — no minimum specified.';
