import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset Your Password",
};

export default function ForgotPasswordPage() {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-14">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">Forgot your password?</h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Enter your email and we'll send you a link to reset it.
        </p>
        <div className="mt-8 rounded border border-line bg-surface p-6">
          <ForgotPasswordForm />
        </div>
      </div>
    </Container>
  );
}
