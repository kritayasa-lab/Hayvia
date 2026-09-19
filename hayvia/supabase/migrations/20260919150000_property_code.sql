-- =============================================================================
-- 20260919150000_property_code.sql
-- =============================================================================
-- Phase 8A — Property Identity Foundation.
--
-- Introduces `properties.property_code` (e.g. "SP-000127") as the permanent,
-- human-readable BUSINESS identity for a property — distinct from every
-- other identity-shaped column already on this table:
--
--   properties.id            -> database/FK identity (uuid, immutable)
--   properties.property_code -> business identity (THIS migration, immutable)
--   properties.slug          -> URL identity (editable, unrelated to this)
--   properties.external_ref  -> legacy Sheets/import bridge (untouched)
--
-- external_ref is NOT reused for this — it means something different
-- (a migration/idempotency key tied to the old Sheets importer) and mixing
-- the two would make external_ref's existing `on conflict (external_ref)`
-- upsert semantics ambiguous. See the Phase 8 Blueprint for the full
-- rationale; this migration implements Phase 8A only.
--
-- Order of operations below matters and is deliberate — it avoids any
-- transient NOT NULL failure and avoids relying on UPDATE...FROM statement
-- execution order for correctness:
--   1. create the sequence
--   2. add property_code as a nullable column
--   3. deterministically backfill every existing row from row_number(),
--      NOT from nextval() — so the assigned numbers are reproducible from
--      the ORDER BY alone, independent of how Postgres executes the UPDATE
--   4. sync the sequence to continue after the backfilled range
--   5. enforce NOT NULL, UNIQUE, and the SP-###### format
--   6. only then install the BEFORE INSERT generator and BEFORE UPDATE
--      immutability guard, so they can never interact with the backfill
--
-- Safe whether `properties` currently holds many rows, one row, or zero.
-- =============================================================================

-- 1. Sequence backing every property_code ever generated. Never reset, never
-- reused — a rolled-back insert simply burns a number, which is the correct,
-- required behavior (numbers are never recycled, including on delete).
create sequence public.property_code_seq;

-- 2. Nullable for now — populated by the backfill below, then locked down.
alter table public.properties
  add column property_code text;

-- 3. Deterministic backfill: chronological order (created_at, then id to
-- break exact-timestamp ties reproducibly), numbered directly by
-- row_number() — never by nextval() — so re-running this SELECT's ordering
-- always reproduces the same assignment regardless of statement execution
-- order.
with ordered as (
  select
    id,
    row_number() over (order by created_at asc, id asc) as rn
  from public.properties
  where property_code is null
)
update public.properties p
set property_code = 'SP-' || lpad(ordered.rn::text, 6, '0')
from ordered
where p.id = ordered.id;

-- 4. Sync the sequence so the next generated code continues immediately
-- after the highest backfilled number. Only called when there's actually a
-- count to sync to — setval() rejects 0 (below the sequence's minvalue of
-- 1), so on a table with zero existing properties this step is skipped
-- entirely and the freshly-created sequence is simply left in its default,
-- never-called state, which already makes the very first nextval() return 1
-- (i.e. SP-000001) — exactly the desired behavior, just via the sequence's
-- own default rather than an explicit setval call.
do $$
declare
  existing_count bigint;
begin
  select count(*) into existing_count from public.properties;
  if existing_count > 0 then
    perform setval('public.property_code_seq', existing_count, true);
  end if;
end;
$$;

-- 5. Lock the column down now that every row has a value.
alter table public.properties
  alter column property_code set not null;

alter table public.properties
  add constraint ux_properties_property_code unique (property_code);

alter table public.properties
  add constraint chk_properties_property_code_format
  check (property_code ~ '^SP-[0-9]{6,}$');

comment on column public.properties.property_code is
  'Permanent, human-readable business identity (e.g. "SP-000127"). Generated server-side by trg_properties_generate_code, immutable after creation (enforced by trg_properties_protect_code). Never client-supplied. Distinct from id (database identity), slug (URL identity), and external_ref (legacy Sheets/import identity) — see migration header comment.';

-- 6a. BEFORE INSERT — always generates a fresh code from the sequence,
-- unconditionally overwriting whatever (if anything) the caller supplied.
-- The client must never be trusted to supply property_code, so this does
-- not merely fill in a null — it ignores any client-provided value outright,
-- the same way created_by/updated_by are always set server-side regardless
-- of form input. (The backfill above runs before this trigger exists, so it
-- never interacts with it.)
create or replace function public.generate_property_code()
returns trigger
language plpgsql
as $$
begin
  new.property_code := 'SP-' || lpad(nextval('public.property_code_seq')::text, 6, '0');
  return new;
end;
$$;

create trigger trg_properties_generate_code
  before insert on public.properties
  for each row
  execute function public.generate_property_code();

-- 6b. BEFORE UPDATE — reject any attempt to change an already-set
-- property_code, regardless of caller (application code, a future admin
-- action, or a manual SQL statement). This is the authoritative enforcement
-- of immutability; the application layer never exposes an editable field for
-- it, but the database is the backstop.
create or replace function public.protect_property_code()
returns trigger
language plpgsql
as $$
begin
  if old.property_code is not null and new.property_code is distinct from old.property_code then
    raise exception 'property_code is immutable and cannot be changed (attempted % -> %)',
      old.property_code, new.property_code;
  end if;
  return new;
end;
$$;

create trigger trg_properties_protect_code
  before update on public.properties
  for each row
  execute function public.protect_property_code();
