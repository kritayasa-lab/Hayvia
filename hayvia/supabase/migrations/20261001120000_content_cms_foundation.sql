-- =============================================================================
-- 20261001120000_content_cms_foundation.sql
-- =============================================================================
-- PR #45 — Content/CMS Foundation. Three structured, admin-editable content
-- tables (Homepage / About / Contact), one row per locale. This is the
-- database + Admin CRUD foundation ONLY -- no public page reads from these
-- tables yet (that's PR #46+). Each table is seeded with exactly one 'en'
-- row containing the real content currently hardcoded in the corresponding
-- page, so the Admin UI has something real to edit from day one, not an
-- empty form -- but editing that row today has zero effect on the live
-- site until a future PR wires the public pages to read from here.
--
-- Deliberately structured tables, not a generic key-value content table
-- (see the PR #45 audit) -- same house style as news_articles (migration
-- 14): real typed columns per page, not a dynamic key list.
--
-- `locale` is included on every table now (default 'en', unique per
-- table) so a future multilingual pass is an additive INSERT of more rows
-- per locale, not a schema change -- no i18n routing/UI is implemented in
-- this migration, this is purely not painting the schema into a
-- single-language corner.
--
-- RLS/security: identical posture to news_articles (migration 14) --
-- public SELECT only, no anon/authenticated write grants of any kind.
-- Every admin write goes through the service-role client
-- (lib/supabase/admin.ts) from server-only code that has already verified
-- the caller's session has profiles.role = 'ADMIN' (see lib/auth/admin.ts),
-- the same pattern used by every other admin-only write path in this
-- schema -- not a new authorization mechanism.
-- =============================================================================


-- =============================================================================
-- 1. homepage_content
-- =============================================================================
-- Covers exactly the homepage copy that is currently hardcoded in
-- app/page.tsx and is reasonable to make editable later: the hero title,
-- the Featured section's heading/description, the Popular Locations
-- heading, and the closing CTA heading/body. Nothing else on the homepage
-- (property data, type/location counts, etc.) belongs in a content table --
-- those are already correctly derived from public_properties.
create table public.homepage_content (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en',

  hero_title text,
  featured_heading text,
  featured_description text,
  popular_locations_heading text,
  cta_heading text,
  cta_body text,

  updated_at timestamptz not null default now(),

  unique (locale)
);

comment on table public.homepage_content is
  'Admin-editable homepage copy (PR #45 foundation). One row per locale. Not yet read by app/page.tsx -- public wiring is a future PR.';

create trigger trg_homepage_content_updated_at
  before update on public.homepage_content
  for each row execute function public.set_updated_at();

alter table public.homepage_content enable row level security;

create policy "Public can view homepage content"
  on public.homepage_content for select
  using (true);

revoke all on public.homepage_content from anon, authenticated;
grant select on public.homepage_content to anon, authenticated;

-- Seeded with the real copy currently hardcoded in app/page.tsx (post PR #44).
insert into public.homepage_content (
  locale, hero_title, featured_heading, featured_description,
  popular_locations_heading, cta_heading, cta_body
) values (
  'en',
  'Find a place that feels like home.',
  'Featured properties in Songkhla & Phuket',
  'A sample of the kind of listings we work with — furnished condos, family houses and everything in between.',
  'Popular locations',
  'Have a property in Songkhla or Phuket?',
  'List it with us and reach tenants and buyers looking for exactly what you offer. Every submission is reviewed before it goes live.'
);


-- =============================================================================
-- 2. about_content
-- =============================================================================
-- Covers the current About page (app/about/page.tsx) content: the main
-- heading, its two body paragraphs, the three "How we think about this"
-- value cards, and the closing "Have a property to list?" CTA.
--
-- `value_cards` is a bounded, always-exactly-3-entry JSON array
-- ([{title, description}, ...]) rather than a child table -- the About
-- page has never had a variable number of these, and a JSON column keeps
-- this one table self-contained, matching how the admin form renders it
-- (three fixed title/description field pairs, not a dynamic add/remove
-- list). Named value_cards, not `values`, since VALUES is a reserved SQL
-- keyword.
create table public.about_content (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en',

  heading text,
  body_1 text,
  body_2 text,
  value_cards jsonb not null default '[]'::jsonb,
  cta_heading text,
  cta_body text,

  updated_at timestamptz not null default now(),

  unique (locale)
);

comment on table public.about_content is
  'Admin-editable About page copy (PR #45 foundation). One row per locale. value_cards is a fixed 3-entry [{title, description}] array matching the current "How we think about this" section. Not yet read by app/about/page.tsx -- public wiring is a future PR.';

create trigger trg_about_content_updated_at
  before update on public.about_content
  for each row execute function public.set_updated_at();

alter table public.about_content enable row level security;

create policy "Public can view about content"
  on public.about_content for select
  using (true);

revoke all on public.about_content from anon, authenticated;
grant select on public.about_content to anon, authenticated;

-- Seeded with the real copy currently hardcoded in app/about/page.tsx.
insert into public.about_content (
  locale, heading, body_1, body_2, value_cards, cta_heading, cta_body
) values (
  'en',
  'A simpler way to find your place in Hat Yai.',
  'Subphiphat Real Estate helps people discover selected rental properties in Hat Yai and connect with local property owners and agents. We built this for anyone who''s ever tried to rent a place in a new city and found the process scattered across Facebook groups, word of mouth and listings with missing information.',
  'Our focus is long-term rentals for international tenants — Malaysian and Singaporean visitors, students, professionals and families relocating to Hat Yai — as well as Thai customers looking for a clearer rental process.',
  '[
    {"title": "Selected, not exhaustive", "description": "We don''t try to list every property in Hat Yai. We''d rather show fewer, clearer listings than an overwhelming, unverified feed."},
    {"title": "Matching is manual, for now", "description": "A real person reviews every Get Matched submission. We''re not claiming automated AI matching — we think a human reviewing your needs does better work at this stage."},
    {"title": "We''re a connector, not the landlord", "description": "Subphiphat Real Estate doesn''t own the properties listed here. We help you find suitable options and connect you with the property owner or agent who manages them."}
  ]'::jsonb,
  'Have a property to list?',
  'We''re always reviewing new properties from owners and agents across Hat Yai.'
);


-- =============================================================================
-- 3. contact_content
-- =============================================================================
-- Covers the Contact page's own copy (heading/subheading) PLUS every field
-- that already exists in config/contact.ts today -- brand, tagline,
-- descriptor, WhatsApp number/link, LINE id/link, email/link, Facebook/
-- Instagram links, city, siteUrl. No field beyond that list is invented.
-- config/contact.ts itself is NOT removed or wired to this table in this
-- PR -- this table exists so a future PR can make these values
-- Admin-editable without a further schema change.
create table public.contact_content (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en',

  heading text,
  subheading text,

  brand text,
  tagline text,
  descriptor text,
  whatsapp_number text,
  whatsapp_link text,
  line_id text,
  line_link text,
  email text,
  email_link text,
  facebook_link text,
  instagram_link text,
  city text,
  site_url text,

  updated_at timestamptz not null default now(),

  unique (locale)
);

comment on table public.contact_content is
  'Admin-editable Contact page copy + the values currently hardcoded in config/contact.ts (PR #45 foundation). One row per locale. Not yet read by app/contact/page.tsx or config/contact.ts -- public wiring is a future PR.';

create trigger trg_contact_content_updated_at
  before update on public.contact_content
  for each row execute function public.set_updated_at();

alter table public.contact_content enable row level security;

create policy "Public can view contact content"
  on public.contact_content for select
  using (true);

revoke all on public.contact_content from anon, authenticated;
grant select on public.contact_content to anon, authenticated;

-- Seeded with the real copy currently hardcoded in app/contact/page.tsx and
-- the real values currently in config/contact.ts.
insert into public.contact_content (
  locale, heading, subheading,
  brand, tagline, descriptor,
  whatsapp_number, whatsapp_link,
  line_id, line_link,
  email, email_link,
  facebook_link, instagram_link,
  city, site_url
) values (
  'en',
  'Get in touch',
  'Questions? Looking for a property? Want to list a property? Reach us however is easiest for you.',
  'Subphiphat Real Estate',
  'Find Your Place in Thailand.',
  'Property • Living • Local Services',
  '+66812345678',
  'https://wa.me/66812345678',
  '@subphiphatrealestate',
  'https://line.me/R/ti/p/@subphiphatrealestate',
  'hello@subphiphatrealestate.com',
  'mailto:hello@subphiphatrealestate.com',
  'https://facebook.com/subphiphatrealestate',
  'https://instagram.com/subphiphatrealestate',
  'Hat Yai, Songkhla, Thailand',
  'https://subphiphatrealestate.com'
);
