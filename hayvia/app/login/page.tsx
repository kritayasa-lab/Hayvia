import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log In",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-14">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">Welcome back</h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Log in to save properties, track inquiries and manage your matches.
        </p>

        {searchParams.error && (
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-sm text-red-600">
            {searchParams.error}
          </p>
        )}

        <div className="mt-8 rounded border border-line bg-surface p-6">
          <LoginForm />
        </div>
      </div>
    </Container>
  );
}
