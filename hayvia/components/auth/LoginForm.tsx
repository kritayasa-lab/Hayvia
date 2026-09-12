"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { Phone, Mail } from "lucide-react";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import Turnstile from "@/components/auth/Turnstile";
import { requestPhoneOtpForLogin, signInWithEmail } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

type Tab = "phone" | "email";

export default function LoginForm() {
  const [tab, setTab] = useState<Tab>("phone");
  const [phoneState, phoneAction] = useFormState(requestPhoneOtpForLogin, null);
  const [emailState, emailAction] = useFormState(signInWithEmail, null);

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
          <FieldWrapper label="Phone number" htmlFor="login-phone" required>
            <TextInput
              id="login-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+66 81 234 5678"
              required
            />
          </FieldWrapper>
          <FormMessage state={phoneState} />
          <Turnstile action="login_phone" />
          <SubmitButton pendingLabel="Sending code..." className="w-full">
            Send Code
          </SubmitButton>
        </form>
      ) : (
        <form action={emailAction} className="mt-6 space-y-4">
          <FieldWrapper label="Email" htmlFor="login-email" required>
            <TextInput
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </FieldWrapper>
          <FieldWrapper label="Password" htmlFor="login-password" required>
            <TextInput
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </FieldWrapper>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-moss-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <FormMessage state={emailState} />
          <Turnstile action="login_email" />
          <SubmitButton pendingLabel="Logging in..." className="w-full">
            Log In
          </SubmitButton>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        Don't have an account?{" "}
        <Link href="/register" className="font-medium text-moss-700 hover:underline">
          Register
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
