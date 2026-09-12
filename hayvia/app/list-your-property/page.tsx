import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import ListPropertyForm from "@/components/forms/ListPropertyForm";

export const metadata: Metadata = {
  title: "List Your Property",
  description:
    "Have a rental property in Hat Yai? Submit your property details for review and possible inclusion on Subphiphat Real Estate.",
};

export default function ListYourPropertyPage() {
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">
          Have a property in Hat Yai?
        </h1>
        <p className="mt-3 text-ink-soft">
          Tell us about your property and we'll review it for inclusion on Subphiphat Real Estate.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl rounded border border-line bg-surface p-6 sm:p-10">
        <ListPropertyForm />
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-ink-faint">
        All properties are manually reviewed before appearing on the platform. Submitting
        this form does not automatically publish your property.
      </p>
    </Container>
  );
}
