"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import Turnstile from "@/components/auth/Turnstile";
import { requestPasswordReset } from "@/lib/auth/actions";

export default function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, null);

  return (
    <div>
      <form action={formAction} className="space-y-4">
        <FieldWrapper label="Email" htmlFor="forgot-email" required>
          <TextInput
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </FieldWrapper>
        <FormMessage state={state} />
        <Turnstile action="forgot_password" />
        <SubmitButton pendingLabel="Sending..." className="w-full">
          Send Reset Link
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/login" className="font-medium text-moss-700 hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
