# Subphiphat Real Estate — Database Schema (Phase 2)

This documents the Supabase PostgreSQL schema defined in `supabase/migrations/`.
**This schema is not yet connected to the production website.** The site still
reads from Google Sheets via `lib/properties-source.ts`, and Get Matched leads
still flow to the same Google Apps Script. Nothing in this phase changes that.

---

## 1. How to apply these migrations

**Using the Supabase CLI** (recommended, keeps a migration history):
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**Using the Supabase SQL Editor** (no CLI required): open each file in
`supabase/migrations/` **in filename order** (they're numbered 1–11) and run
them one at a time. Order matters — later files reference tables/enums
created in earlier ones.

---

## 2. Every table, what it's for, and its key relationships

### Reference / lookup tables
| Table | Purpose | Key relationships |
|---|---|---|
| `locations` | Structured Thailand location hierarchy (country → province → city → district → subdistrict) with a slug for SEO pages like `/rent/hat-yai`. | Optionally referenced by `properties.location_id`. |
| `amenities` | Reusable amenity tags ("Swimming pool", "Fitness room"). | Many-to-many with `properties` via `property_amenities`. |

### People
| Table | Purpose | Key relationships |
|---|---|---|
| `profiles` | 1:1 extension of `auth.users`. Holds `full_name`, mirrored `email`/`phone`, `phone_verified`, and `role` (USER/ADMIN/STAFF/AGENT/OWNER). Auto-created by a trigger (`handle_new_auth_user`) whenever someone signs up. | Referenced by nearly every other table (`created_by`, `assigned_staff`, `user_id`, etc.). |
| `admin_users` | Staff-only metadata (employee code, department, access level) for profiles whose role is ADMIN/STAFF/AGENT. Kept separate so customer profiles stay lean. | 1:1 with `profiles`. |
| `owners` | **Private.** Property owner contact info + default commission. | Referenced by `properties.owner_id`. |
| `agents` | **Private.** Agent contact info, agency, license, commission split. | Referenced by `properties.agent_id`. |

### Properties
| Table | Purpose | Key relationships |
|---|---|---|
| `properties` | The core listing table — see section 4 for the public/private field split. | → `owners`, `agents`, `locations`, `profiles` (created_by/updated_by). |
| `property_images` | One row per photo, ordered, with a single designated cover image (enforced by a partial unique index). | → `properties`, cascade delete. |
| `property_amenities` | Many-to-many junction between `properties` and `amenities`. | Composite PK `(property_id, amenity_id)`. |

### Leads / CRM
| Table | Purpose | Key relationships |
|---|---|---|
| `seller_leads` | Raw "Sell Your Property" submissions. Never auto-published. | Optional `user_id` (guest sellers allowed). |
| `inquiries` | Raw property inquiries (Contact/Enquire/Request Viewing). | → `properties`, optional `user_id`. |
| `leads` | Unified CRM work queue — one row per thing staff need to follow up on, regardless of source. See the design note in section 5. A CHECK constraint enforces that the right source column is set for each `source_type` (added in migration 11 — see section 3.1a). | Optionally → `inquiries`, `seller_leads`, `matching_preferences`, `properties`. |
| `lead_notes` | Free-text staff notes on a lead, timestamped, attributed to an author. | → `leads`, cascade delete. |
| `lead_status_history` | Every status transition a lead went through, for a full audit trail. | → `leads`, cascade delete. |
| `viewings` | Viewing requests, separate from generic inquiries since they carry a date/time/status. | → `properties`, optional → `leads`. |

### Customer engagement
| Table | Purpose | Key relationships |
|---|---|---|
| `favorites` | Saved properties. Composite PK `(user_id, property_id)` — a user can only favorite a property once. | → `profiles`, `properties`. |
| `property_views` | Append-only view log, for both logged-in users (`user_id`) and anonymous visitors (`session_id`). | → `properties`. `properties.view_count` is a fast denormalized counter, not derived from this table on every read. |

### Matching engine
| Table | Purpose | Key relationships |
|---|---|---|
| `matching_preferences` | One row per matching quiz run. Supports anonymous sessions (`session_id`) as well as logged-in users. Location granularity goes down to `subdistrict` (added in migration 11). | Optional → `profiles`. |
| `matching_results` | Calculated match scores (0–100) per property for a given preferences run, plus a `score_breakdown` JSON for transparency. | → `matching_preferences`, `properties`. Unique per (preference, property). |
| `matching_weights` | **Addition beyond your explicit list** — lets an admin change the scoring weights (Budget 30%, Location 25%, etc.) without a code deploy. Exactly one row is `is_active = true` at a time (enforced by a partial unique index), and the weights must sum to 100 (enforced by a CHECK constraint). Seeded with your example weighting. | Standalone; read by the Phase 9 matching engine. |

### Admin operations
| Table | Purpose | Key relationships |
|---|---|---|
| `audit_logs` | Sensitive admin action trail (property published, owner assigned, role changed, etc.). | Optional → `profiles`. |
| `backup_logs` | Tracks every Supabase → Google Sheets backup attempt, so admin can see what's synced/pending/failed and retry safely. | Standalone; keyed by `(entity_type, entity_id, destination)` for idempotency. |

---

## 3. Design decisions worth reviewing

1. **`leads` vs `inquiries`/`seller_leads`.** These are deliberately separate. `inquiries` and `seller_leads` are the raw, form-shaped capture tables. `leads` is a CRM layer on top — one uniform status pipeline (`NEW → CONTACTED → QUALIFIED → VIEWING → NEGOTIATING → WON/LOST`) and staff assignment, regardless of whether the lead came from a property inquiry, a seller submission, a matching session, or the existing Get Matched form. A `leads` row optionally points back to its source via nullable `inquiry_id`/`seller_lead_id`/`matching_preference_id`.

   **1a. Source-relationship validation (migration 11).** Which source column is *required* for which `source_type` is now enforced by a database CHECK constraint, not just an app-level convention: `INQUIRY` requires `inquiry_id`, `SELLER_LEAD` requires `seller_lead_id`, `MATCHING` requires `matching_preference_id`, and `MANUAL`/`GET_MATCHED`/`OTHER` require none. This holds regardless of which code path writes the row.

2. **Locations: denormalized on `properties`, with an optional structured `locations` table.** Section 7 lists `country/province/city/district/subdistrict/latitude/longitude` as direct fields on `properties` (fast, join-free reads on every listing page — this matters at "thousands of properties" scale). Section 6 also asks for a `locations` table so new cities don't require schema changes. I did both: `properties` stores its own location fields directly, and can *optionally* link to `locations` via `location_id` for SEO location pages (`/rent/hat-yai`) and consistent autocomplete data. Adding a new province/city is just a new `locations` row — no migration needed.

3. **`lifestyle_preferences` as a Postgres enum array, not a junction table.** Section 14 lists 14 fixed lifestyle tags (near beach, quiet area, pet friendly, etc.). I used `lifestyle_preference_enum[]` on `matching_preferences` with a GIN index, rather than a `lifestyle_tags` lookup + junction table. This is simpler and fully sufficient for a fixed, small tag list; the trade-off is that adding a 15th tag later requires an `ALTER TYPE ... ADD VALUE` migration rather than an `INSERT`. If you expect this list to change often or want it admin-editable, a junction table would be the better call — happy to switch it before Phase 9 if so.

4. **Free-text `minimum_rental` and `deposit` fields.** These stayed as free text (e.g. `"6 months"`, `"2 months rent + 1 month advance"`) rather than being normalized into numeric/structured fields, specifically to preserve fidelity with the existing Google Sheets data for Phase 4's migration. This can be normalized later without much pain.

5. **`external_ref` and `legacy_amenities_raw` on `properties`.** Added specifically to support Phase 4. `external_ref` stores the original Google Sheets "ID" so the import script can `INSERT ... ON CONFLICT (external_ref) DO UPDATE` — running the import twice updates existing rows instead of duplicating them, per your requirement. `legacy_amenities_raw` keeps the original comma-separated amenities string temporarily for audit/debugging while `property_amenities` is being verified; safe to drop later.

6. **Commission fields as type + value, not a single number.** `commission_type` (PERCENT/FIXED) + `commission_value` (numeric), on both `owners` (as a default) and `properties` (can override per-listing). This is a small addition beyond the literal spec wording ("commission information") but avoids ambiguity about whether a stored number means a percentage or a flat fee.

---

## 4. Public vs. private fields — critical for sections 12/13/30

**RLS controls which *rows* a role can see — not which *columns*.** A property
can be fully `PUBLISHED` and still have owner/commission data that must never
reach the browser. That's a column-level concern, so it's solved with a view,
not a row policy:

- **`public.public_properties`** is a VIEW over `properties` that only
  includes public-safe columns, filtered to `status = 'PUBLISHED'`. It
  deliberately **excludes**: `owner_id`, `agent_id`, `source`, `source_url`,
  `commission_type`, `commission_value`, `private_notes`, `created_by`,
  `updated_by`, `external_ref`, `legacy_amenities_raw`.
- Direct `SELECT` on the raw `properties` table is **revoked** from
  `anon`/`authenticated` entirely (`REVOKE ALL ... FROM anon, authenticated`).
  Only the view is granted.
- **The Next.js data-access layer (Phase 5) must query `public_properties`
  for every public-facing request**, and only query the raw `properties`
  table from server-side, admin-authenticated code paths using the
  service-role key. This is the enforcement point that matters most — no
  database structure alone can stop application code from selecting the
  wrong table, so this needs to be a hard rule in the Phase 5 data layer.

**`property_images` / `property_amenities` — corrected in migration 11.**
These tables hold no private columns themselves, but their RLS policy needs
to check the *parent property's* status without granting them (or their
caller) direct access to `properties`. The original migration 10 policy did
this with a raw `EXISTS (select ... from properties ...)` inside `USING`,
which is broken: that subquery runs as the querying role, and since
`properties` has RLS-deny-all for anon with no policy, the subquery could
never see any row — published or not. Migration 11 replaces this with a
`SECURITY DEFINER` function, `public.is_property_published(uuid)`, owned by
the same role that owns `properties` (and therefore bypasses that table's
RLS the same way `public_properties` does). The function exposes only a
boolean via `GRANT EXECUTE` — never row data — and the two policies now call
it instead of querying `properties` directly. Explicit `SELECT`-only grants
were also added for `locations`, `amenities`, `property_images`, and
`property_amenities` so their public access doesn't rely on an unstated
assumption about Supabase's default table privileges.

**Fully private tables** (no public read at all, not even a filtered view):
`owners`, `agents`, `admin_users`, `audit_logs`, `backup_logs`. RLS is
enabled with zero policies for `anon`/`authenticated`, **and** (as of
migration 11) all table-level grants to those roles are explicitly revoked
too — a deliberate defense-in-depth choice for the five tables that should
never be reachable by anon/authenticated even after Phase 11, so a single
future mistake (an accidental permissive policy, say) isn't enough on its
own to expose them. These are only reachable via the service-role key,
server-side.

**Own-row-only tables** (a user should eventually see their own data, nobody
else's): `profiles`, `favorites`, `property_views`, `inquiries` (where
`user_id` matches), `seller_leads` (where `user_id` matches),
`matching_preferences` (where `user_id` matches), `leads` and its child
tables, `viewings`. These are left with default table grants (relying on
Supabase's own default privilege bootstrap) since Phase 11 will manage them
properly with real `auth.uid()`-based policies — revoking now would just be
churn, since RLS-deny already fully protects them today. See section 6 below
for why the Phase 11 policies aren't written yet.

---

## 5. Row Level Security — current state

Every table has RLS **enabled**. In Postgres, enabling RLS with zero policies
means **deny-all** for any role without the `BYPASSRLS` attribute — which is
exactly what we want as a safe default. The `service_role` key (used only in
server-side code, e.g. Next.js API routes or the Phase 4 migration script)
bypasses RLS entirely, by design, and is how the application will read/write
these tables until Phase 11.

**Policies added now** (all auth-independent — they don't need `auth.uid()`,
so they're safe to ship before Supabase Auth exists):
- Public read on `locations` (active only) and `amenities`.
- Public read on `property_images`/`property_amenities` where the parent
  property is published, via the `is_property_published()` security-definer
  function (migration 11 — see section 4 above for why the original
  version of this policy didn't actually work).
- Public read on the `public_properties` view.

**Policies deliberately deferred to Phase 11** (everything that needs to
check "is this the requesting user's own row" or "is this user an admin"):
profiles, favorites, property_views, inquiries, seller_leads,
matching_preferences/results, leads and its child tables, viewings, owners,
agents, admin_users, audit_logs, backup_logs. Writing these now, before
Supabase Auth exists to test against, would mean shipping untested
authorization logic — this is the main reason Phase 3 needs to happen before
Phase 11.

---

## 6. How this supports Rent / Buy / Sell (section 7/8)

- `properties.listing_type` (`RENT`/`BUY`) is the top-level split. `rental_period`
  is only meaningful for `RENT` listings (left nullable rather than
  DB-constrained, to keep the schema flexible as listing types evolve).
- "Sell" is handled entirely upstream of `properties`: a `seller_leads` row
  is created from the public form, reviewed by admin, and only becomes an
  actual `properties` row (with `listing_type = 'BUY'`, `status = 'DRAFT'` or
  `'PENDING_REVIEW'`) once approved — nothing here auto-publishes a
  submission.

## 7. How this supports multiple cities/provinces (section 6)

`properties` stores its own `country/province/city/district/subdistrict`
directly (no schema change needed to add a new city — it's just a new value
in those text columns). The optional `locations` table is the structured,
de-duplicated reference used for dropdown data, SEO location pages, and
lat/lng centroids for map defaults. Adding "Phuket" or "Krabi" is an `INSERT`
into `locations`, not a migration.

## 8. How this supports the matching engine (section 14/15)

`matching_preferences` captures one full quiz run (purpose, location, budget
range, property type, bedrooms, furnished, parking, lifestyle tags — steps 1–6
in section 15). `matching_results` stores the calculated score per property
plus a JSON breakdown of each weighted component, so a "94% Match" badge can
be explained, not just displayed. `matching_weights` holds the actual
percentages used, editable by an admin later without a deploy, defaulting to
the weighting from section 14 (Budget 30 / Location 25 / Property Type 15 /
Bedrooms 10 / Lifestyle 10 / Amenities 5 / Availability 5 — enforced to sum
to 100 by a CHECK constraint).

## 9. How this supports Google Sheets backup (section 45)

`backup_logs` records every sync attempt from Supabase to Google Sheets —
`entity_type` + `entity_id` + `destination` (e.g. `google_sheets:properties`,
`google_sheets:leads`) + `status` (PENDING/SUCCESS/FAILED) + `retry_count`.
This is what Phase 12's backup sync job and the admin "Data Backup" screen
(section 45.10/45.11) will read from. The unique combination of
`(entity_type, entity_id, destination)` is what makes the sync idempotent —
re-running a backup updates the existing log row's status rather than
creating a duplicate, and (per section 45.9) the actual Sheets row itself
should be looked up/updated by the same stable ID, not appended blindly.

---

## 10. What's explicitly NOT in this phase

- No connection from the Next.js app to Supabase yet — `lib/properties-source.ts`
  is untouched.
- No Supabase Auth, no OTP, no login/signup pages (Phase 3).
- No data migrated from Google Sheets yet (Phase 4).
- No RLS policies that depend on `auth.uid()` or role checks (Phase 11).
- No admin dashboard UI (Phase 10).

---

## 11. Phase 2 correction pass (migration 11)

A follow-up security/schema review found and fixed the following, all in
`20260912100011_phase2_security_corrections.sql`:

1. **Fixed a real bug**, not just a hardening improvement: the
   `property_images`/`property_amenities` public-read policies from
   migration 10 could never actually return rows (see section 4 above for
   the full explanation) — replaced with a `SECURITY DEFINER` function,
   `is_property_published()`.
2. **Added explicit `SELECT`-only grants** for `locations`, `amenities`,
   `property_images`, `property_amenities` (previously relying on an
   unstated assumption about Supabase's default privileges), and explicit
   `REVOKE ALL` for `owners`, `agents`, `admin_users`, `audit_logs`,
   `backup_logs` as defense-in-depth beyond RLS alone.
3. **Added `subdistrict` to `matching_preferences`**, plus a supporting
   index, so matching can score at the same location granularity as
   properties.
4. **Added a CHECK constraint on `leads`** enforcing that `INQUIRY` /
   `SELLER_LEAD` / `MATCHING` source types have their corresponding source
   id set, while `MANUAL`/`GET_MATCHED`/`OTHER` don't require one.
5. **Added 6 missing foreign-key indexes**: `leads.inquiry_id`,
   `leads.seller_lead_id`, `leads.property_id`, `viewings.lead_id`,
   `viewings.user_id`, `seller_leads.user_id`.
