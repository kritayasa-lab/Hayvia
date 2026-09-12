"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import { linkEmailToAccount } from "@/lib/auth/actions";

export default function LinkEmailPanel() {
  const [state, formAction] = useFormState(linkEmailToAccount, null);

  return (
    <div className="rounded border border-line bg-surface p-5">
      <p className="text-sm font-medium text-ink">Add an email address</p>
      <p className="mt-1 text-sm text-ink-soft">
        Add and verify an email so you can also log in with it.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <FieldWrapper label="Email" htmlFor="link-email">
          <TextInput
            id="link-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </FieldWrapper>
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Sending...">Send Confirmation Link</SubmitButton>
      </form>
    </div>
  );
}
