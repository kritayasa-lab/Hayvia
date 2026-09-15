import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import MatchingWizard from "@/components/matching/MatchingWizard";

export const metadata: Metadata = {
  title: "Get Matched",
  description:
    "Tell us what you're looking for in a Hat Yai property — budget, area, property type and lifestyle — and we'll show you your top 3 real matches.",
};

export default function GetMatchedPage() {
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Find your perfect property.</h1>
        <p className="mt-3 text-ink-soft">
          Answer a few questions and we&apos;ll score every current listing against your
          requirements — no account needed.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-4xl rounded border border-line bg-surface p-6 sm:p-10">
        <MatchingWizard />
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-ink-faint">
        Match scores are calculated automatically from real listing data — budget, location,
        property type, bedrooms, lifestyle, amenities and availability. Our team can also
        follow up directly using the details you provide.
      </p>
    </Container>
  );
}
