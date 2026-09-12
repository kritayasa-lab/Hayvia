import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Create an Account",
};

export default function RegisterPage() {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-14">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">Create your account</h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Save properties, track your inquiries, and get matched faster next time.
        </p>
        <div className="mt-8 rounded border border-line bg-surface p-6">
          <RegisterForm />
        </div>
      </div>
    </Container>
  );
}
