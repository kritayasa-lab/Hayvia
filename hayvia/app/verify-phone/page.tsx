import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import VerifyPhoneForm from "@/components/auth/VerifyPhoneForm";
import { maskPhoneForDisplay } from "@/lib/auth/phone";

export const metadata: Metadata = {
  title: "Verify Your Phone",
};

export default function VerifyPhonePage() {
  const phone = cookies().get("sre_pending_phone")?.value;

  // No pending verification in progress — nothing to verify against.
  if (!phone) {
    redirect("/login");
  }

  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-14">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">Verify your phone</h1>
        <div className="mt-8 rounded border border-line bg-surface p-6">
          <VerifyPhoneForm maskedPhone={maskPhoneForDisplay(phone)} />
        </div>
      </div>
    </Container>
  );
}
