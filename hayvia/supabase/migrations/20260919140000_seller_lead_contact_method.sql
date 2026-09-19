-- =============================================================================
-- 20260919140000_seller_lead_contact_method.sql
-- =============================================================================
-- Seller Lead intake — preferred contact method.
--
-- The public "List Your Property" form already collects name/email/phone,
-- but has no way to record HOW a seller prefers to be reached, or their
-- LINE ID / WhatsApp number when that's the channel they picked. Mirrors
-- the existing `properties.contact_type` column's own convention (plain
-- text + CHECK, not a new enum type — see migration 15) rather than
-- inventing a second pattern for the same kind of value.
--
-- Additive only: three new nullable columns, no table, no enum, no RLS
-- change, no impact on any existing row or query.
-- =============================================================================

alter table public.seller_leads
  add column preferred_contact_method text
    check (preferred_contact_method is null or preferred_contact_method in ('PHONE', 'LINE', 'WHATSAPP', 'EMAIL')),
  add column line_id text,
  add column whatsapp_number text;

comment on column public.seller_leads.preferred_contact_method is
  'How this seller prefers to be reached: PHONE, LINE, WHATSAPP, or EMAIL. Null for submissions made before this column existed.';
comment on column public.seller_leads.line_id is
  'Seller''s LINE ID, collected only when preferred_contact_method = LINE.';
comment on column public.seller_leads.whatsapp_number is
  'Seller''s WhatsApp number, collected only when preferred_contact_method = WHATSAPP. Distinct from `phone`, which may be a different number.';
