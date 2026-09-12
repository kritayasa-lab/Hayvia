"use client";

import { useState } from "react";
import { resendEmailVerification } from "@/lib/auth/actions";
import FormMessage from "@/components/auth/FormMessage";
import type { ActionState } from "@/lib/auth/actions";

export default function ResendEmailButton() {
  const [state, setState] = useState<ActionState | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleResend() {
    setIsSending(true);
    setState(null);
    const result = await resendEmailVerification();
    setState(result);
    setIsSending(false);
  }

  return (
    <div className="mt-5">
      {state && (
        <div className="mb-3">
          <FormMessage state={state} />
        </div>
      )}
      <button
        type="button"
        onClick={handleResend}
        disabled={isSending}
        className="text-sm font-medium text-moss-700 hover:underline disabled:cursor-not-allowed disabled:text-ink-faint"
      >
        {isSending ? "Resending..." : "Resend verification email"}
      </button>
    </div>
  );
}
