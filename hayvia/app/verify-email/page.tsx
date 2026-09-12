import type { Metadata } from "next";
import { cookies } from "next/headers";
import { MailCheck } from "lucide-react";
import Container from "@/components/ui/Container";
import ResendEmailButton from "@/components/auth/ResendEmailButton";

export const metadata: Metadata = {
  title: "Verify Your Email",
};

export default function VerifyEmailPage() {
  const email = cookies().get("sre_pending_email")?.value;

  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-14">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-moss-50 text-moss-700">
          <MailCheck size={24} />
        </span>
        <h1 className="mt-4 font-display text-2xl text-ink">Check your email</h1>
        <p className="mt-2 text-sm text-ink-soft">
          We sent a confirmation link
          {email ? (
            <>
              {" "}
              to <span className="font-medium text-ink">{email}</span>
            </>
          ) : (
            ""
          )}
          . Click the link to activate your account.
        </p>
        <ResendEmailButton />
      </div>
    </Container>
  );
}
