"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { Phone, Mail } from "lucide-react";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import Turnstile from "@/components/auth/Turnstile";
import { requestPhoneOtpForRegister, signUpWithEmail } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

type Tab = "phone" | "email";

export default function RegisterForm() {
  const [tab, setTab] = useState<Tab>("phone");
  const [phoneState, phoneAction] = useFormState(requestPhoneOtpForRegister, null);
  const [emailState, emailAction] = useFormState(signUpWithEmail, null);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 rounded border border-line bg-surface p-1">
        <TabButton active={tab === "phone"} onClick={() => setTab("phone")} icon={Phone}>
          Continue with Phone
        </TabButton>
        <TabButton active={tab === "email"} onClick={() => setTab("email")} icon={Mail}>
          Continue with Email
        </TabButton>
      </div>

      {tab === "phone" ? (
        <form action={phoneAction} className="mt-6 space-y-4">
          <FieldWrapper label="Phone number" htmlFor="register-phone" required>
            <TextInput
              id="register-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+66 81 234 5678"
              required
            />
          </FieldWrapper>
          <FormMessage state={phoneState} />
          <Turnstile action="register_phone" />
          <SubmitButton pendingLabel="Sending code..." className="w-full">
            Send Code
          </SubmitButton>
        </form>
      ) : (
        <form action={emailAction} className="mt-6 space-y-4">
          <FieldWrapper label="Full name" htmlFor="register-name" required>
            <TextInput id="register-name" name="fullName" autoComplete="name" required />
          </FieldWrapper>
          <FieldWrapper label="Email" htmlFor="register-email" required>
            <TextInput
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </FieldWrapper>
          <FieldWrapper label="Password" htmlFor="register-password" required hint="At least 8 characters">
            <TextInput
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </FieldWrapper>
          <FieldWrapper label="Confirm password" htmlFor="register-confirm-password" required>
            <TextInput
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </FieldWrapper>
          <FormMessage state={emailState} />
          <Turnstile action="register_email" />
          <SubmitButton pendingLabel="Creating account..." className="w-full">
            Create Account
          </SubmitButton>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-moss-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Phone;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-moss-600 text-white" : "text-ink-soft hover:bg-line-soft"
      )}
    >
      <Icon size={16} />
      {children}
    </button>
  );
}
