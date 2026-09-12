"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import { updatePassword } from "@/lib/auth/actions";

export default function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePassword, null);

  return (
    <form action={formAction} className="space-y-4">
      <FieldWrapper label="New password" htmlFor="reset-password" required hint="At least 8 characters">
        <TextInput
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </FieldWrapper>
      <FieldWrapper label="Confirm new password" htmlFor="reset-confirm-password" required>
        <TextInput
          id="reset-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </FieldWrapper>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Updating..." className="w-full">
        Update Password
      </SubmitButton>
    </form>
  );
}
