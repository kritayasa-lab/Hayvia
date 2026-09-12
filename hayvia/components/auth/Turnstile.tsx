"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Script from "next/script";

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export interface TurnstileHandle {
  /** Clears the current token and asks Cloudflare for a fresh one. */
  reset: () => void;
}

interface TurnstileProps {
  action: string;
  /**
   * Called every time a fresh token is issued (initial render, and again
   * after every reset()). Only needed by callers that trigger a Supabase
   * call imperatively rather than via a plain <form> submit — e.g. the
   * phone OTP resend button. Pass a stable function (like a useState
   * setter) — see VerifyPhoneForm.tsx for the intended usage.
   */
  onToken?: (token: string) => void;
}

/**
 * Cloudflare Turnstile widget — official explicit-rendering JS API only, no
 * custom CAPTCHA logic of any kind.
 *
 * Always renders a hidden `cf-turnstile-response` input so any surrounding
 * <form> continues to pick up the token via FormData automatically
 * (Login/Register/ForgotPassword all just do `<Turnstile action="..." />`
 * with no other changes needed). Also exposes the raw token via `onToken`
 * plus an imperative `reset()` ref handle for flows — like phone OTP
 * resend — that need a fresh token available in JS state before making a
 * Supabase call that didn't come from a form submission.
 */
const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(function Turnstile(
  { action, onToken },
  ref
) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (window.turnstile && widgetIdRef.current) {
        setToken("");
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    if (!siteKey || !scriptLoaded || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) return; // already rendered once — reset() handles refreshing

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (newToken) => {
        setToken(newToken);
        onToken?.(newToken);
      },
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded, siteKey, action]);

  // Not configured yet — forms keep working, just without a CAPTCHA
  // challenge, until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (see .env.example).
  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} />
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
    </>
  );
});

export default Turnstile;
