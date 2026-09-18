"use client";

import { useState, useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Mail, MailCheck } from "lucide-react";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import Turnstile from "@/components/auth/Turnstile";
import { requestEmailMagicLink } from "@/lib/auth/actions";

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
  }

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

        <form action={formAction} className="mt-6">
          <input type="hidden" name="email" value={email} />
          <FormMessage state={state} />
          <SubmitButton pendingLabel="Sending..." className="w-full" disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend link (${cooldown}s)` : "Resend link"}
          </SubmitButton>
        </form>

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
