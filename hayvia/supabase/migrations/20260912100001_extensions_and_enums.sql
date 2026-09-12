-- =============================================================================
-- 20260912100001_extensions_and_enums.sql
-- =============================================================================
-- Subphiphat Real Estate — Phase 2 database schema
--
-- This is migration 1 of 10. Run in order (they're numbered/timestamped so
-- `supabase migration up` / `supabase db push` applies them correctly, and
-- they're also safe to paste into the Supabase SQL editor one at a time in
-- order).
--
-- SCOPE OF THIS FILE: extensions + every enum type used by later migrations.
-- Enums are created first so every subsequent CREATE TABLE can reference them.
-- =============================================================================

-- gen_random_uuid() — enabled by default on Supabase projects, but declared
-- here explicitly so this migration set is reproducible on a fresh database.
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------
-- User / staff roles (section 9)
-- -----------------------------------------------------------------------
create type user_role_enum as enum (
  'USER',
  'ADMIN',
  'STAFF',
  'AGENT',
  'OWNER'
);

-- -----------------------------------------------------------------------
-- Property system (section 7)
-- -----------------------------------------------------------------------
create type listing_type_enum as enum (
  'RENT',
  'BUY'
);

create type property_type_enum as enum (
  'CONDO',
  'APARTMENT',
  'HOUSE',
  'TOWNHOUSE',
  'VILLA',
  'LAND',
  'COMMERCIAL',
  'OTHER'
);

create type property_status_enum as enum (
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'RESERVED',
  'RENTED',
  'SOLD',
  'HIDDEN',
  'ARCHIVED'
);

create type furnished_enum as enum (
  'FULLY_FURNISHED',
  'PARTIALLY_FURNISHED',
  'UNFURNISHED'
);

-- Only meaningful when listing_type = RENT; nullable for BUY listings.
create type rental_period_enum as enum (
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY'
);

create type commission_type_enum as enum (
  'PERCENT',
  'FIXED'
);

create type owner_status_enum as enum (
  'ACTIVE',
  'INACTIVE'
);

create type agent_status_enum as enum (
  'ACTIVE',
  'INACTIVE'
);

-- -----------------------------------------------------------------------
-- Leads / CRM (sections 8, 11, 21)
-- -----------------------------------------------------------------------
create type seller_lead_status_enum as enum (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'REJECTED',
  'CONVERTED'
);

create type inquiry_type_enum as enum (
  'CONTACT',
  'ENQUIRE',
  'REQUEST_VIEWING'
);

create type inquiry_status_enum as enum (
  'NEW',
  'CONTACTED',
  'IN_PROGRESS',
  'CLOSED',
  'SPAM'
);

-- The unified CRM "leads" table can originate from several places.
create type lead_source_type_enum as enum (
  'INQUIRY',
  'SELLER_LEAD',
  'MATCHING',
  'GET_MATCHED',
  'MANUAL',
  'OTHER'
);

create type lead_type_enum as enum (
  'RENT',
  'BUY',
  'SELL',
  'GENERAL'
);

create type lead_status_enum as enum (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'VIEWING',
  'NEGOTIATING',
  'WON',
  'LOST'
);

create type viewing_status_enum as enum (
  'REQUESTED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED'
);

-- -----------------------------------------------------------------------
-- Matching engine (section 14) — lifestyle preference tags
-- -----------------------------------------------------------------------
create type lifestyle_preference_enum as enum (
  'NEAR_BEACH',
  'NEAR_AIRPORT',
  'NEAR_HOSPITAL',
  'NEAR_UNIVERSITY',
  'QUIET_AREA',
  'FAMILY_FRIENDLY',
  'PET_FRIENDLY',
  'FOREIGN_FRIENDLY',
  'LONG_STAY',
  'INVESTMENT',
  'POOL',
  'GYM',
  'PARKING',
  'WIFI'
);

-- -----------------------------------------------------------------------
-- Google Sheets backup layer (section 45)
-- -----------------------------------------------------------------------
create type backup_status_enum as enum (
  'PENDING',
  'SUCCESS',
  'FAILED'
);
