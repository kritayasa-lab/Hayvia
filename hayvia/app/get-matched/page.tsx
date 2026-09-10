import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import GetMatchedForm from "@/components/forms/GetMatchedForm";

export const metadata: Metadata = {
  title: "Get Matched",
  description:
    "Tell us what you're looking for in a Hat Yai rental — budget, area, property type and more — and we'll help you find suitable options.",
};

export default function GetMatchedPage() {
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">
          Tell us what you're looking for.
        </h1>
        <p className="mt-3 text-ink-soft">
          Share a few details and we'll help you find properties that fit your needs.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl rounded border border-line bg-surface p-6 sm:p-10">
        <GetMatchedForm />
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-ink-faint">
        Matching is currently handled by our team — we review your requirements and
        reach out with suitable properties. This is not an automated process.
      </p>
    </Container>
  );
}
