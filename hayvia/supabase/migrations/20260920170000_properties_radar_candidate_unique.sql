-- =============================================================================
-- 20260920170000_properties_radar_candidate_unique.sql
-- =============================================================================
-- Database-level double-conversion protection for Radar → Property
-- conversion (PR #17 review finding).
--
-- properties.radar_property_candidate_id (added in
-- 20260920160000_radar_foundation.sql) already has a plain index, but
-- nothing stopped two rows from pointing at the same Radar candidate. The
-- application-level guard in createProperty() (checks the candidate isn't
-- already CONVERTED, and that no property already links to it, before
-- inserting) is check-then-act and not safe against two concurrent
-- conversion requests for the same candidate. A partial unique index closes
-- that race at the only layer that can actually guarantee it.
--
-- Partial (not a plain unique index) so it only constrains rows that
-- actually have a Radar origin — every property with
-- radar_property_candidate_id null (the overwhelming majority: staff-created
-- or Seller-Lead-originated properties) is completely unaffected. Mirrors
-- the existing ux_customers_email / ux_customers_phone_e164 partial-unique
-- convention from 20260912100016_customer_identity_phase1.sql.
--
-- Additive only: one new index, no table, no column, no RLS change, no
-- impact on any existing row (adding a unique index over already-unique
-- data never fails) or on any other query.
-- =============================================================================

create unique index ux_properties_radar_candidate on public.properties (radar_property_candidate_id)
  where radar_property_candidate_id is not null;
