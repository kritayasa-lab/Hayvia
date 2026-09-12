import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a New Password",
};

export default function ResetPasswordPage() {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-14">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">Set a new password</h1>
        <div className="mt-8 rounded border border-line bg-surface p-6">
          <ResetPasswordForm />
        </div>
      </div>
    </Container>
  );
}
