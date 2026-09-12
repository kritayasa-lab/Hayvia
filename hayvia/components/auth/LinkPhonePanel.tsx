"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import { requestPhoneOtpForLink } from "@/lib/auth/actions";

export default function LinkPhonePanel() {
  const [state, formAction] = useFormState(requestPhoneOtpForLink, null);

  return (
    <div className="rounded border border-line bg-surface p-5">
      <p className="text-sm font-medium text-ink">Add a phone number</p>
      <p className="mt-1 text-sm text-ink-soft">
        Add and verify a phone number so you can also log in with it.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <FieldWrapper label="Phone number" htmlFor="link-phone">
          <TextInput
            id="link-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+66 81 234 5678"
            required
          />
        </FieldWrapper>
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Sending code...">Send Verification Code</SubmitButton>
      </form>
    </div>
  );
}
