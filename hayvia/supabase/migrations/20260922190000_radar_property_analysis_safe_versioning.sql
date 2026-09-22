-- =============================================================================
-- 20260922190000_radar_property_analysis_safe_versioning.sql
-- =============================================================================
-- Phase 8D-3 — concurrency-safe radar_property_analysis version allocation.
--
-- runAiAnalysisAction() previously computed the next version as a separate
-- `select count(*)` followed by a plain `insert` — a classic TOCTOU race.
-- Two concurrent "Run AI Analysis" calls for the same candidate (a double
-- click, two admins, or a retried request) could both read the same count
-- and both attempt to insert the same version, tripping
-- radar_property_analysis's own `unique (candidate_id, version)` constraint
-- for one of them, or worse — without that constraint — silently producing
-- two rows claiming the same version number.
--
-- Fix: a single SQL function that locks the parent candidate row (`for
-- update`) before computing max(version)+1 and inserting, so the whole
-- read-then-write is atomic per candidate. A second concurrent caller for
-- the SAME candidate simply blocks on the row lock until the first
-- transaction commits (or rolls back) — Postgres serializes them, so the
-- second caller's max(version) recomputation is always correct. Different
-- candidates are never contended against each other (a per-row lock, not a
-- table lock), so this doesn't serialize analysis writes across the whole
-- table.
--
-- Called via supabase.rpc('insert_radar_property_analysis', {...}) from
-- app/admin/(dashboard)/radar/properties/actions.ts — the only caller.
-- Never called from any other admin surface, and never exposed to
-- anon/authenticated: PostgREST grants EXECUTE on new functions to PUBLIC
-- by default, so this explicitly revokes it and grants back to
-- service_role only, matching this schema's existing "Radar tables are
-- service-role only" posture (radar_foundation.sql) — RLS alone doesn't
-- cover a SECURITY INVOKER function's own table access from a role that
-- isn't already blocked some other way, so the grant must be explicit.
--
-- No change to radar_property_analysis's columns/constraints, no change to
-- any other table, no change to RLS policies.
-- =============================================================================

create or replace function public.insert_radar_property_analysis(
  p_candidate_id uuid,
  p_model_name text,
  p_model_version text,
  p_facts jsonb,
  p_ai_inference jsonb,
  p_unknowns jsonb,
  p_confidence numeric,
  p_evidence jsonb
)
returns public.radar_property_analysis
language plpgsql
as $$
declare
  v_next_version integer;
  v_row public.radar_property_analysis;
begin
  -- Locks the candidate row for the duration of this transaction. A second
  -- concurrent call for the same candidate_id blocks here until this
  -- transaction ends, which is what makes the max(version)+1 below safe.
  perform 1 from public.radar_property_candidates where id = p_candidate_id for update;
  if not found then
    raise exception 'radar_property_candidates % not found', p_candidate_id;
  end if;

  select coalesce(max(version), 0) + 1
    into v_next_version
    from public.radar_property_analysis
    where candidate_id = p_candidate_id;

  insert into public.radar_property_analysis (
    candidate_id, version, model_name, model_version, facts, ai_inference, unknowns, confidence, evidence
  ) values (
    p_candidate_id, v_next_version, p_model_name, p_model_version, p_facts, p_ai_inference, p_unknowns, p_confidence, p_evidence
  )
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.insert_radar_property_analysis is
  'Phase 8D-3 — atomically allocates the next per-candidate version and inserts the radar_property_analysis row in one transaction, locking the parent candidate row to serialize concurrent callers for the same candidate. Replaces the app-level `select count(*) + 1` race. service_role only — see the grants below.';

revoke execute on function public.insert_radar_property_analysis(uuid, text, text, jsonb, jsonb, jsonb, numeric, jsonb) from public;
revoke execute on function public.insert_radar_property_analysis(uuid, text, text, jsonb, jsonb, jsonb, numeric, jsonb) from anon;
revoke execute on function public.insert_radar_property_analysis(uuid, text, text, jsonb, jsonb, jsonb, numeric, jsonb) from authenticated;
grant execute on function public.insert_radar_property_analysis(uuid, text, text, jsonb, jsonb, jsonb, numeric, jsonb) to service_role;
