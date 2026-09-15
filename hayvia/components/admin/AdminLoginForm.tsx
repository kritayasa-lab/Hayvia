"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import { signInAdmin } from "@/lib/auth/admin-actions";

export default function AdminLoginForm() {
  const [state, action] = useFormState(signInAdmin, null);

  return (
    <form action={action} className="space-y-4">
      <FieldWrapper label="Email" htmlFor="admin-login-email" required>
        <TextInput
          id="admin-login-email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@subphiphatrealestate.com"
          required
        />
      </FieldWrapper>
      <FieldWrapper label="Password" htmlFor="admin-login-password" required>
        <TextInput
          id="admin-login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FieldWrapper>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Signing in..." className="w-full">
        Sign In
      </SubmitButton>
    </form>
  );
}
