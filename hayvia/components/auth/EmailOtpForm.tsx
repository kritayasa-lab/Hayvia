"use client";

import { useState, useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Mail, MailCheck } from "lucide-react";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import Turnstile, { type TurnstileHandle } from "@/components/auth/Turnstile";
import { requestEmailMagicLink, resendEmailMagicLink, type ActionState } from "@/lib/auth/actions";

const RESEND_COOLDOWN_SECONDS = 45;

/**
 * Phase 5 — the single passwordless customer login/registration form.
 * Deliberately has no "new vs returning" branching before send (see
 * requestEmailMagicLink's own comment) — the only state this component
 * manages is "entering an email" vs "link sent", plus a client-side resend
 * cooldown (pacing layer on top of, not instead of, Supabase's own rate
 * limits and Turnstile — same posture as the existing phone OTP flow).
 */
export default function EmailOtpForm() {
  const [state, formAction] = useFormState(requestEmailMagicLink, null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();

  // Resend — imperative, not form-bound, so it can carry a freshly issued
  // Turnstile token as a plain argument (see resendEmailMagicLink).
  const [resendState, setResendState] = useState<ActionState | null>(null);
  const [isResending, setIsResending] = useState(false);
  // Held only in memory for this component's lifetime — never a cookie or
  // the database. Cleared immediately before use and replaced by a fresh
  // one (via Turnstile's reset()) after every resend, so the initial
  // send's token is never reused here — Turnstile tokens are single-use.
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);

  useEffect(() => {
    if (state?.success) {
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }, [state]);

  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldown]);

  function useAnotherEmail() {
    setSent(false);
    setCooldown(0);
    setEmail("");
    setResendState(null);
    setCaptchaToken("");
  }

  async function handleResend() {
    setIsResending(true);
    setResendState(null);

    // Consume the current token immediately so it can never be reused,
    // then ask Cloudflare for a fresh one for next time regardless of
    // outcome — same discipline as VerifyPhoneForm's resend.
    const tokenForThisRequest = captchaToken || undefined;
    setCaptchaToken("");

    const result = await resendEmailMagicLink(email, tokenForThisRequest);
    turnstileRef.current?.reset();

    setResendState(result);
    setIsResending(false);
    if (!result?.error) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  // Turnstile isn't configured (no site key) -> captchaToken always stays
  // "" and resendEmailMagicLink is simply called with undefined, exactly
  // like the initial send does via getCaptchaToken(). Once a site key IS
  // configured, this gates resend on having a valid, freshly-issued token
  // first — never lets a click through with no token attached.
  const turnstileConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const resendDisabled = cooldown > 0 || isResending || (turnstileConfigured && !captchaToken);

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-moss-50 text-moss-700">
          <MailCheck size={24} />
        </span>
        <h2 className="mt-4 font-display text-xl text-ink">Check your email</h2>
        <p className="mt-2 text-sm text-ink-soft">
          We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. Click the link to
          continue — you can close this tab.
        </p>

        {/* Dedicated Turnstile instance for resend — the initial "Continue
            with Email" submit already consumed its own token, and Turnstile
            tokens are single-use, so resend needs a fresh one of its own. */}
        <div className="mt-4 flex justify-center">
          <Turnstile ref={turnstileRef} action="customer_login_email_resend" onToken={setCaptchaToken} />
        </div>

        {resendState && (
          <div className="mt-3">
            <FormMessage state={resendState} />
          </div>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={resendDisabled}
          className="mt-4 block w-full rounded border border-line px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-moss-500 hover:text-moss-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResending
            ? "Resending..."
            : cooldown > 0
              ? `Resend link (${cooldown}s)`
              : turnstileConfigured && !captchaToken
                ? "Preparing verification..."
                : "Resend link"}
        </button>

        <button
          type="button"
          onClick={useAnotherEmail}
          className="mt-4 text-sm font-medium text-moss-700 hover:underline"
        >
          Use another email
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <FieldWrapper label="Email" htmlFor="login-email" required>
        <TextInput
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </FieldWrapper>
      <FormMessage state={state} />
      <Turnstile action="customer_login_email" />
      <SubmitButton pendingLabel="Sending link..." className="w-full">
        <Mail size={16} />
        Continue with Email
      </SubmitButton>
      <p className="text-center text-xs text-ink-faint">
        No password needed — we&apos;ll email you a secure link to sign in.
      </p>
    </form>
  );
}
