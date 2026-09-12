# Phase 3.1 — Authentication Hardening & Production Readiness

This documents the authentication system as of Phase 3.1, after the resend-CAPTCHA
fix and full audit. It supersedes the auth-relevant parts of the Phase 3 report.

Every claim below is labeled as one of:
- **VERIFIED IN CODE** — confirmed by direct inspection, cross-referencing, or
  static analysis in this sandbox.
- **REQUIRES LIVE SUPABASE TEST** — the logic is correct by design/trace, but
  has never actually run against a real Supabase project.
- **REQUIRES DASHBOARD CONFIGURATION** — application code is ready, but a
  setting in the Supabase Dashboard (or Cloudflare) must be configured before
  this works in production.

---

## A. Authentication architecture

Supabase Auth exclusively — no custom OTP generation, storage, or verification;
no custom password hashing. All identity state lives in `auth.users`
(Supabase-managed). `public.profiles` is a 1:1 mirror, kept in sync by database
triggers, used by application code so it never needs to query the `auth` schema
directly.

```
Browser
  -> Server Actions (lib/auth/actions.ts)
    -> Supabase Auth (signInWithOtp / verifyOtp / signUp / signInWithPassword /
      updateUser / resetPasswordForEmail)
      -> auth.users (Supabase-managed)
        -> triggers -> public.profiles (mirror only)
```

**VERIFIED IN CODE** — every Supabase Auth call in the codebase is one of the
methods listed above; grepped for any custom crypto/hashing/OTP-generation
code and found none.

---

## B. Email flow

1. **Register**: `/register` (email tab) -> `signUpWithEmail` -> `supabase.auth.signUp()` with `emailRedirectTo` pointing at `/auth/confirm?next=/account` -> sets a short-lived `sre_pending_email` cookie (email address only, not a secret) -> redirect to `/verify-email`.
2. **Confirm**: user clicks the link Supabase emails -> `GET /auth/confirm?token_hash=...&type=signup&next=/account` -> `verifyOtp({ type: 'signup', token_hash })` -> session established -> redirect to `/account`.
3. **Login**: `/login` (email tab) -> `signInWithEmail` -> `signInWithPassword()` -> redirect to `/account`. Wrong password and "no such account" return the identical message ("Incorrect email or password.") — no enumeration.
4. **Forgot password**: `/forgot-password` -> `requestPasswordReset` -> `resetPasswordForEmail()` -> **always** the same success message regardless of whether the email exists.
5. **Reset**: link -> `/auth/confirm?type=recovery&next=/reset-password` -> `verifyOtp({ type: 'recovery' })` establishes a temporary session -> `/reset-password` -> `updatePassword` -> `supabase.auth.updateUser({ password })`.
6. **Email change / linking**: `/account` -> `linkEmailToAccount` -> `updateUser({ email }, { emailRedirectTo })`. Supabase's double opt-in means `auth.users.email` does NOT change immediately — it's held in a pending `email_change` field until the new address's confirmation link is clicked, at which point `email` and `email_confirmed_at` update together, on the **same** `auth.users` row.

**VERIFIED IN CODE** — all 6 steps traced against actual Supabase JS client method signatures.
**REQUIRES LIVE SUPABASE TEST** — nothing above has been executed against a real project.

---

## C. Phone OTP flow

1. **Register**: `/register` (phone tab) -> `requestPhoneOtpForRegister` -> `signInWithOtp({ phone, options: { shouldCreateUser: true, captchaToken } })` -> sets `sre_pending_phone` + `sre_pending_phone_purpose` cookies -> redirect to `/verify-phone`.
2. **Login**: same page, `requestPhoneOtpForLogin` -> `shouldCreateUser: false` — if the phone has no account, Supabase errors and the UI shows "No account found... Try registering instead," which is what stops `/login` from ever silently creating a second identity.
3. **Verify**: `/verify-phone` -> `verifyPhoneOtp` -> `verifyOtp({ phone, token: code, type: 'sms' })` (or `'phone_change'` when linking — see below) -> clears the pending cookies -> redirect to `/account`.
4. **Resend — FIXED in Phase 3.1**: previously called with zero arguments and no CAPTCHA token at all. Now:
   - `VerifyPhoneForm.tsx` mounts a **second, dedicated** Turnstile widget (the "Send Code" request on `/login`/`/register` already consumed its own token — Turnstile tokens are single-use, so it can't be reused for resend).
   - The widget's `onToken` callback feeds a token into local component state — never a cookie, never localStorage, never sent to any server until the moment resend is clicked.
   - Clicking "Resend" consumes that token immediately (cleared from state so it can never be reused), passes it as a plain function argument to `resendPhoneOtp(token)`, then calls the widget's `reset()` so a fresh token is ready for next time.
   - `resendPhoneOtp` now accepts `captchaToken?: string` and forwards it through the same `requestPhoneOtpInternal` path as the initial request — same Supabase call, same `options.captchaToken` mechanism, zero custom CAPTCHA logic.
   - The resend button is disabled until a token is ready (only relevant once Turnstile is actually configured) or the cooldown has elapsed.
5. **Cooldown**: 45-second client-side timer, independent of Turnstile — a UX pacing layer on top of, not instead of, Supabase's own server-side rate limits.
6. **Link phone to an existing account**: `/account` -> `requestPhoneOtpForLink` -> `updateUser({ phone })` (Supabase's double opt-in equivalent for phone — a pending `phone_change`, not an immediate change) -> user is sent through `/verify-phone` again, but `verifyPhoneOtp` uses `type: 'phone_change'` instead of `'sms'` for this purpose, which is what completes the swap on the same `auth.users` row.

**VERIFIED IN CODE** — including the resend fix, traced end-to-end.
**REQUIRES LIVE SUPABASE TEST** — especially: confirm Supabase's actual OTP rate-limit error text so `mapAuthError()`'s substring matching catches it (see section F).

---

## D. Account linking flow

| Scenario | Mechanism |
|---|---|
| Phone-first -> add email | `updateUser({ email })` from `/account`, while authenticated. Updates the **same** `auth.users` row (pending until confirmed). |
| Email-first -> add phone | `updateUser({ phone })` from `/account`, then `verifyOtp({ type: 'phone_change' })`. Same row. |
| Never creates a duplicate profile | Both paths only ever call `updateUser()` on the *currently authenticated* session — never `signUp`/`signInWithOtp` with `shouldCreateUser: true`. The `AFTER UPDATE ON auth.users` trigger (`handle_auth_user_update`, migration 12) syncs the linked identifier into the *same* `profiles` row (matched by `id`, the shared primary key). No code path in this app can insert a second `profiles` row for one person. |

**VERIFIED IN CODE** — by tracing which Supabase method is called from every entry point; confirmed none of the linking paths use `shouldCreateUser: true` or `signUp`.
**REQUIRES LIVE SUPABASE TEST** — the double opt-in timing (pending `email_change`/`phone_change` fields, when exactly `auth.users.email`/`phone` actually swap) is standard, documented Supabase behavior, but hasn't been observed directly against a live project in this work.

---

## E. CAPTCHA architecture (Cloudflare Turnstile)

- `components/auth/Turnstile.tsx` uses Cloudflare's **explicit rendering** JS API (`window.turnstile.render()`), loaded via `next/script` — no third-party npm package, no custom challenge logic.
- **Form-based usage** (Login, Register, Forgot Password): `<Turnstile action="..." />` with no other props — the widget writes its token into a hidden `cf-turnstile-response` input, which arrives in the Server Action's `FormData` automatically. `getCaptchaToken()` reads it; `mapAuthError()` (new in 3.1) gives a clean message if Supabase rejects it.
- **Imperative usage** (phone OTP resend, the only non-form CAPTCHA consumer): `<Turnstile ref={...} onToken={setState} />` — exposes the raw token to JS and a `reset()` handle to fetch a new one after each use.
- The Turnstile **secret** key is never in this codebase at all — it lives only in Supabase Dashboard's Attack Protection settings, where Supabase verifies tokens directly with Cloudflare server-side.
- Renders nothing (`return null`) if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` isn't set — every form keeps working without a challenge until you configure it.

**VERIFIED IN CODE.**
**REQUIRES DASHBOARD CONFIGURATION** — see section H.

---

## F. RLS / security model

`public.profiles`:
- `SELECT`: `auth.uid() = id` only.
- `UPDATE`: `auth.uid() = id` only (row-level). **Column-level** protection for `role`, `phone_verified`, `phone_verified_at`, `email_verified`, `email_verified_at` is enforced by the `protect_profile_system_fields()` trigger (re-verified in this pass, unchanged from Phase 3 QA) — it uses `pg_trigger_depth() > 1` to distinguish "this is our own `handle_auth_user_update` trigger cascading a legitimate sync" from "a client is directly calling `.update()`," which is more reliable than checking `auth.role()` alone, since Supabase's own auth backend may not carry the original request's JWT role claim into its internal database session.
- **No `INSERT` policy** — rows are only created by the `SECURITY DEFINER` `handle_new_auth_user()` trigger.
- **No `DELETE` policy** — account deletion isn't in scope for this phase.

`auth.users -> profiles` sync (both re-verified, unchanged):
- `handle_new_auth_user()` (`AFTER INSERT`) — seeds `email`, `phone`, and both verification flags from `auth.users`' own confirmation timestamps at creation time.
- `handle_auth_user_update()` (`AFTER UPDATE`) — re-syncs all of the above whenever `auth.users` changes (OTP verified, email confirmed, identifier linked).

Everything else (owners, agents, admin_users, audit_logs, backup_logs, the raw `properties` table) is **completely untouched by any Phase 3/3.1 migration** — confirmed by grepping which tables migration 12 references (only `profiles` and `auth.users` triggers).

**VERIFIED IN CODE** — re-confirmed by direct inspection of migration 12's policy/trigger definitions in this session, not just re-stated from memory.
**REQUIRES LIVE SUPABASE TEST** — a genuine attempt to `UPDATE profiles SET role = 'ADMIN'` or `phone_verified = true` as an authenticated non-service-role user has not actually been run against a live database.

---

## G. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL           client + server
NEXT_PUBLIC_SUPABASE_ANON_KEY      client + server (respects RLS)
SUPABASE_SERVICE_ROLE_KEY          server-only - lib/supabase/admin.ts, guarded by the `server-only` package
NEXT_PUBLIC_SITE_URL               server-only usage today (redirect URL construction), safe to expose
NEXT_PUBLIC_TURNSTILE_SITE_KEY     client-side (Turnstile widget) - optional, degrades gracefully if unset
```

**VERIFIED IN CODE**: grepped the entire repository for `SUPABASE_SERVICE_ROLE_KEY` — appears only in `lib/supabase/admin.ts` and `.env.example`. Grepped every `"use client"` file for any non-`NEXT_PUBLIC_` `process.env` reference — none found. `.gitignore` covers `.env` and `.env*.local`.

---

## H. Required Supabase Dashboard configuration

1. **Authentication > URL Configuration** — add `Redirect URLs`:
   - `http://localhost:3000/auth/confirm` (local dev)
   - `https://subphiphatrealestate.com/auth/confirm` (production)
   - Your Vercel preview domain pattern, if you use preview deployments.
2. **Authentication > Providers > Phone** — enable, and configure an SMS provider (Twilio, MessageBird, or Vonage — pick one; entirely Dashboard config, no app code involved).
3. **Authentication > Rate Limits** — review the defaults for SMS sends/hour and email sends/hour; tighten if needed for your expected traffic.
4. **Authentication > Attack Protection** — enable "CAPTCHA protection," select **Turnstile**, paste your Cloudflare **secret** key. Do this only after confirming the resend fix (section C.4) behaves as expected in your own testing, since resend now depends on it.
5. **Authentication > Email Templates** — confirm (or edit) the Confirm signup / Reset password / Change email templates to link to:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}
   ```
   Add `&next=/account` (or `&next=/reset-password` for the recovery template) if you want to control the post-verification landing page explicitly — the route handler defaults to `/account` if `next` is omitted.

**REQUIRES DASHBOARD CONFIGURATION** — none of this can be done from application code; I'm not able to configure your Supabase project directly.

---

## I. Required Supabase Auth providers

- **Email** (built-in, on by default).
- **Phone** — must be explicitly enabled with an SMS provider (see H.2). Without this, every phone OTP call in the app will fail with a Supabase-side "phone provider not configured" error.

---

## J. Rate-limit recommendations

Starting points (adjust based on real traffic once live):
- SMS: 5 per hour per phone number, 10 per hour per IP.
- Email: Supabase's defaults are usually reasonable for a small-to-medium site; revisit if you see abuse.
- These are configured entirely in Dashboard > Auth > Rate Limits — not something this codebase can set.

---

## K. Known limitations

1. Forgot-password's CAPTCHA failure is masked by the generic "if an account exists..." success message (documented trade-off — anti-enumeration takes priority; Supabase's own rate limiting still applies underneath regardless of what the UI shows).
2. `mapAuthError()`'s substring matching against Supabase's error text is based on documented/typical Supabase error strings, not confirmed against a live project's actual error responses — see section M.
3. No automated tests exist for any of this — everything is verified by manual code trace only.

---

## L. Testing status summary

| Area | Status |
|---|---|
| Resend CAPTCHA fix | VERIFIED IN CODE |
| All 34 flows in the Phase 3.1 request | VERIFIED IN CODE (trace-through) |
| RLS/trigger column protection | VERIFIED IN CODE (re-inspected, not just re-stated) |
| Security-leak grep audit | VERIFIED IN CODE |
| `npm run build` / `npx tsc --noEmit` / `npm run lint` | **NOT VERIFIED** — no network access in this environment to `npm install` |
| Any live Supabase call of any kind | **NOT VERIFIED** — no live Supabase project connected in this environment |

---

## M. What you should do before considering this production-ready

1. Run `npm install && npm run build && npx tsc --noEmit && npm run lint` yourself and report back anything that fails.
2. Connect a real (ideally staging) Supabase project and manually run through all 34 flows listed in the Phase 3.1 request — particularly the account-linking scenarios and the resend-with-CAPTCHA-enabled path.
3. Only enable Dashboard > Attack Protection's CAPTCHA enforcement after confirming resend works end-to-end in your own testing.
