import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import EmailOtpForm from "@/components/auth/EmailOtpForm";

export const metadata: Metadata = {
  title: "Sign In",
};

// Phase 5 — passwordless customer login/registration, single entry point.
// See components/auth/EmailOtpForm.tsx and lib/auth/actions.ts's
// requestEmailMagicLink for why there's no separate register page and no
// password field. `?error=` is populated by app/auth/confirm/route.ts's
// GET handler when a magic link is missing/invalid/expired.
export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-14">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">Sign in</h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Enter your email to sign in or create your account.
        </p>
        <div className="mt-8 rounded border border-line bg-surface p-6">
          {searchParams.error && (
            <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {searchParams.error}
            </p>
          )}
          <EmailOtpForm />
        </div>
      </div>
    </Container>
  );
}
