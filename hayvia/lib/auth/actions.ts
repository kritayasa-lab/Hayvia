"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeToE164 } from "@/lib/auth/phone";
import { getSiteUrl } from "@/lib/site-url";

export interface ActionState {
  error?: string;
  success?: string;
}

const PENDING_PHONE_COOKIE = "sre_pending_phone";
const PENDING_PHONE_PURPOSE_COOKIE = "sre_pending_phone_purpose";
const PENDING_EMAIL_COOKIE = "sre_pending_email";

const PENDING_COOKIE_MAX_AGE = 60 * 10; // 10 minutes — just long enough to receive and enter a code

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NETWORK_ERROR = "We couldn't reach the server. Please check your connection and try again.";

/**
 * Cloudflare Turnstile injects a hidden `cf-turnstile-response` input into
 * its widget's container div automatically — this just reads it back out.
 * Returns undefined (not an error) when Turnstile isn't configured yet, so
 * these forms keep working before NEXT_PUBLIC_TURNSTILE_SITE_KEY is set —
 * Supabase itself is what actually enforces the captcha requirement, once
 * it's turned on in the Dashboard (see the Phase 3.1 report).
 */
function getCaptchaToken(formData: FormData): string | undefined {
  const token = formData.get("cf-turnstile-response");
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

function pendingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: PENDING_COOKIE_MAX_AGE,
    path: "/",
  };
}

/**
 * Maps a raw Supabase Auth error message to a safe, clear, user-facing one.
 * Centralized here (Phase 3.1 hardening) rather than scattered ad-hoc
 * `.includes()` checks across every action, so every entry point handles
 * rate limits, CAPTCHA failures, expired/invalid codes, etc. consistently
 * — and so raw Supabase/Postgres internals are never shown to a visitor.
 * Deliberately vague where precision would aid an attacker (e.g. it does
 * not distinguish "wrong password" from "no such account").
 */
function mapAuthError(rawMessage: string): string {
  const msg = rawMessage.toLowerCase();

  if (msg.includes("rate limit") || msg.includes("security purposes") || msg.includes("too many")) {
    return "You're trying too often. Please wait a moment and try again.";
  }
  if (msg.includes("captcha")) {
    return "Verification challenge failed. Please try again.";
  }
  if (msg.includes("already registered") || msg.includes("already exists")) {
    return "An account with that already exists. Try logging in instead.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please verify your email before logging in. Check your inbox.";
  }
  if (msg.includes("invalid login credentials") || msg.includes("invalid grant")) {
    return "Incorrect email or password.";
  }
  if (msg.includes("expired")) {
    return "That code or link has expired. Please request a new one.";
  }
  if (msg.includes("invalid otp") || msg.includes("token is invalid") || msg.includes("invalid token")) {
    return "That code is incorrect. Please try again.";
  }
  if (msg.includes("phone") && msg.includes("invalid")) {
    return "Please enter a valid phone number.";
  }

  return GENERIC_ERROR;
}

// -----------------------------------------------------------------------
// Phone OTP — login / register / link-to-existing-account.
//
// `purpose` is decided by the SERVER (by which exported action was called),
// never trusted from client input, since it controls whether Supabase is
// allowed to create a brand-new account (shouldCreateUser). This is what
// stops the /login screen from silently creating a duplicate identity for
// someone who already has an account under a different phone/email.
//
// Note on "phone already registered": when purpose is "register"
// (shouldCreateUser: true) and the phone already belongs to an existing
// user, Supabase does NOT error — it transparently sends a login OTP to
// that existing user instead. That's the correct, desired behavior (no
// duplicate account, no information leaked about whether the phone existed
// already), so there's deliberately no special-cased error for it.
// -----------------------------------------------------------------------

async function requestPhoneOtpInternal(
  rawPhone: string,
  purpose: "login" | "register" | "link",
  captchaToken?: string
): Promise<ActionState> {
  const phone = normalizeToE164(rawPhone);
  if (!phone) {
    return { error: "Please enter a valid phone number, including country code if outside Thailand." };
  }

  try {
    const supabase = createClient();

    if (purpose === "link") {
      // Adds this phone to the CURRENTLY authenticated account rather than
      // creating a new one — this is the Supabase-native mechanism for
      // attaching a second identifier to a single identity. No captcha
      // here — this action requires an existing authenticated session
      // already, a much smaller abuse surface than an anonymous entry point.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { error: "You must be signed in to add a phone number." };
      }
      const { error } = await supabase.auth.updateUser({ phone });
      if (error) return { error: mapAuthError(error.message) };
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: purpose === "register", captchaToken },
      });
      if (error) {
        if (purpose === "login") {
          return { error: "No account found with that phone number. Try registering instead." };
        }
        return { error: mapAuthError(error.message) };
      }
    }

    const cookieStore = cookies();
    cookieStore.set(PENDING_PHONE_COOKIE, phone, pendingCookieOptions());
    cookieStore.set(PENDING_PHONE_PURPOSE_COOKIE, purpose, pendingCookieOptions());
  } catch (err) {
    // Next.js's redirect() works by throwing a special internal error —
    // let that pass through untouched, only swallow genuine failures.
    if (isNextRedirectError(err)) throw err;
    return { error: NETWORK_ERROR };
  }

  redirect("/verify-phone");
}

export async function requestPhoneOtpForLogin(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  return requestPhoneOtpInternal(String(formData.get("phone") || ""), "login", getCaptchaToken(formData));
}

export async function requestPhoneOtpForRegister(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  return requestPhoneOtpInternal(String(formData.get("phone") || ""), "register", getCaptchaToken(formData));
}

export async function requestPhoneOtpForLink(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  return requestPhoneOtpInternal(String(formData.get("phone") || ""), "link");
}

/**
 * FIXED in Phase 3.1: now accepts a fresh Turnstile token (captured client-
 * side by a dedicated Turnstile widget mounted on /verify-phone — see
 * VerifyPhoneForm.tsx) and forwards it to Supabase exactly like the initial
 * "Send Code" request does. The token is passed as a plain function
 * argument, never stored in a cookie or the database, and is discarded by
 * the caller immediately after this single use (VerifyPhoneForm clears its
 * local state and asks Turnstile for a new token right after calling this).
 */
export async function resendPhoneOtp(captchaToken?: string): Promise<ActionState> {
  const cookieStore = cookies();
  const phone = cookieStore.get(PENDING_PHONE_COOKIE)?.value;
  const purpose = cookieStore.get(PENDING_PHONE_PURPOSE_COOKIE)?.value as
    | "login"
    | "register"
    | "link"
    | undefined;

  if (!phone || !purpose) {
    return { error: "Your verification session expired. Please start again." };
  }

  return requestPhoneOtpInternal(phone, purpose, captchaToken);
}

export async function verifyPhoneOtp(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const code = String(formData.get("code") || "").trim();
  const cookieStore = cookies();
  const phone = cookieStore.get(PENDING_PHONE_COOKIE)?.value;
  const purpose = cookieStore.get(PENDING_PHONE_PURPOSE_COOKIE)?.value as
    | "login"
    | "register"
    | "link"
    | undefined;

  if (!phone || !purpose) {
    return { error: "Your verification session expired. Please start again." };
  }
  if (!code) {
    return { error: "Please enter the 6-digit code." };
  }

  try {
    const supabase = createClient();

    // "sms" verifies an initial sign-in/sign-up OTP; "phone_change" verifies
    // an OTP sent to confirm adding a phone to an already-authenticated
    // account. Both are Supabase's own verifyOtp types — nothing custom.
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: purpose === "link" ? "phone_change" : "sms",
    });

    if (error) {
      // Deliberately generic — doesn't distinguish "expired" from "wrong
      // code" from "too many attempts", so a script can't use the response
      // to narrow down what went wrong.
      return { error: "That code is incorrect or has expired. Please try again or resend." };
    }

    cookieStore.delete(PENDING_PHONE_COOKIE);
    cookieStore.delete(PENDING_PHONE_PURPOSE_COOKIE);
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: NETWORK_ERROR };
  }

  redirect(purpose === "link" ? "/account?linked=phone" : "/account");
}

// -----------------------------------------------------------------------
// Email + password
// -----------------------------------------------------------------------

export async function signUpWithEmail(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!fullName) return { error: "Please enter your name." };
  if (!email || !email.includes("@")) return { error: "Please enter a valid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/account`,
        data: { full_name: fullName },
        captchaToken: getCaptchaToken(formData),
      },
    });

    if (error) return { error: mapAuthError(error.message) };

    cookies().set(PENDING_EMAIL_COOKIE, email, pendingCookieOptions());
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: NETWORK_ERROR };
  }

  redirect("/verify-email");
}

export async function signInWithEmail(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: getCaptchaToken(formData) },
    });

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return { error: "Please verify your email before logging in. Check your inbox." };
      }
      // Deliberately the same generic message for "no such user" and
      // "wrong password" — distinguishing them would let an attacker
      // enumerate registered emails.
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        return { error: "Incorrect email or password." };
      }
      return { error: mapAuthError(error.message) };
    }
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: NETWORK_ERROR };
  }

  redirect("/account");
}

export async function resendEmailVerification(): Promise<ActionState> {
  const email = cookies().get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) {
    return { error: "Your verification session expired. Please register again." };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/account` },
    });

    if (error) return { error: mapAuthError(error.message) };
    return { success: "Verification email sent again — check your inbox." };
  } catch {
    return { error: NETWORK_ERROR };
  }
}

export async function linkEmailToAccount(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  if (!email || !email.includes("@")) return { error: "Please enter a valid email." };

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to add an email." };

    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/account` }
    );

    if (error) return { error: mapAuthError(error.message) };
    return { success: "Check your new email address for a confirmation link." };
  } catch {
    return { error: NETWORK_ERROR };
  }
}

// -----------------------------------------------------------------------
// Password recovery
// -----------------------------------------------------------------------

export async function requestPasswordReset(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email." };
  }

  try {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
      captchaToken: getCaptchaToken(formData),
    });
  } catch {
    return { error: NETWORK_ERROR };
  }

  // Always return the same success message whether or not the email is
  // actually registered — this prevents using the form to enumerate which
  // emails have accounts. (Note: this means a CAPTCHA failure is currently
  // masked by the generic success message too — deliberate trade-off in
  // favor of not leaking account existence; Supabase's own rate limiting
  // still applies underneath regardless of what the UI shows.)
  return {
    success: "If an account exists for that email, we've sent a password reset link.",
  };
}

export async function updatePassword(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Your password reset link has expired. Please request a new one." };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: mapAuthError(error.message) };
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: NETWORK_ERROR };
  }

  redirect("/account?passwordReset=true");
}

// -----------------------------------------------------------------------
// Sign out
// -----------------------------------------------------------------------

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// -----------------------------------------------------------------------
// Next.js's redirect() throws a special error internally to short-circuit
// rendering — every try/catch above must let that specific "error" continue
// propagating rather than treating it as a real failure, or every
// successful redirect in this file would get swallowed as NETWORK_ERROR.
// -----------------------------------------------------------------------
function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
```