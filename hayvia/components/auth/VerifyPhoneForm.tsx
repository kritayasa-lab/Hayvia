"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { verifyPhoneOtp, resendPhoneOtp } from "@/lib/auth/actions";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import Turnstile, { type TurnstileHandle } from "@/components/auth/Turnstile";
import type { ActionState } from "@/lib/auth/actions";

const RESEND_COOLDOWN_SECONDS = 45;

export default function VerifyPhoneForm({ maskedPhone }: { maskedPhone: string }) {
  const [verifyState, verifyAction] = useFormState(verifyPhoneOtp, null);
  const [resendState, setResendState] = useState<ActionState | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Held only in memory for the lifetime of this component — never written
  // to a cookie or the database. Cleared immediately before use and
  // replaced by a fresh one (via Turnstile's reset()) after every resend,
  // so a token is never reused across requests.
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    setIsResending(true);
    setResendState(null);

    // Consume the current token immediately so it can never be reused, then
    // ask Cloudflare for a fresh one for next time regardless of outcome.
    const tokenForThisRequest = captchaToken || undefined;
    setCaptchaToken("");

    const result = await resendPhoneOtp(tokenForThisRequest);
    turnstileRef.current?.reset();

    setResendState(result);
    setIsResending(false);
    if (!result?.error) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  // Turnstile isn't configured (no site key) -> captchaToken always stays
  // "" and resendPhoneOtp is simply called with undefined, exactly like
  // before this fix. Once a site key IS configured, this gates resend on
  // having a valid, freshly-issued token first.
  const turnstileConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const resendDisabled =
    cooldown > 0 || isResending || (turnstileConfigured && !captchaToken);

  return (
    <div>
      <p className="text-sm text-ink-soft">
        We sent a 6-digit code to <span className="font-medium text-ink">{maskedPhone}</span>.
      </p>

      <form action={verifyAction} className="mt-6 space-y-4">
        <FieldWrapper label="Verification code" htmlFor="otp-code" required>
          <TextInput
            id="otp-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            required
            className="text-center text-lg tracking-[0.5em]"
          />
        </FieldWrapper>
        <FormMessage state={verifyState} />
        <SubmitButton pendingLabel="Verifying..." className="w-full">
          Verify
        </SubmitButton>
      </form>

      {/* Dedicated Turnstile instance for resend — the "Send Code" form on
          /login or /register already consumed its own token, and Turnstile
          tokens are single-use, so resend needs a fresh one of its own. */}
      <Turnstile ref={turnstileRef} action="phone_resend" onToken={setCaptchaToken} />

      <div className="mt-5 text-center">
        {resendState && (
          <div className="mb-3">
            <FormMessage state={resendState} />
          </div>
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendDisabled}
          className="text-sm font-medium text-moss-700 hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
        >
          {isResending
            ? "Resending..."
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : turnstileConfigured && !captchaToken
                ? "Preparing verification..."
                : "Resend code"}
        </button>
      </div>
    </div>
  );
}
