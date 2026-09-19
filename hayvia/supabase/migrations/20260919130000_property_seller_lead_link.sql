-- =============================================================================
-- 20260919130000_property_seller_lead_link.sql
-- =============================================================================
-- Phase 7 — Seller Lead -> Property conversion traceability.
--
-- Adds the ONE column genuinely missing for "Approve & Create Property":
-- which seller_leads submission (if any) a given property was created from.
-- Nullable, one-way (ON DELETE SET NULL — deleting a seller lead must never
-- delete or orphan the property it produced), no new table, no new enum,
-- no RLS change. Mirrors the exact same traceability pattern already used
-- elsewhere in this schema (leads.seller_lead_id, leads.matching_preference_id).
--
-- Privacy note: public.public_properties (see migration 15) is defined with
-- an explicit column list, not `select *` — this column is NOT added to
-- that list, so it is never exposed to the public site. Admin-only, read
-- via the service-role client exactly like every other private property
-- column (owner_id, agent_id, source, commission_*, private_notes).
-- =============================================================================

alter table public.properties
  add column seller_lead_id uuid references public.seller_leads (id) on delete set null;

comment on column public.properties.seller_lead_id is
  'Optional traceability link to the seller_leads submission this property was created from via Admin "Approve & Create Property". Null for properties created directly by staff with no seller lead behind them. Admin-only — never exposed via public_properties.';

create index ix_properties_seller_lead on public.properties (seller_lead_id);
