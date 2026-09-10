import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import PropertiesExplorer from "@/components/property/PropertiesExplorer";
import { properties } from "@/data/properties";

export const metadata: Metadata = {
  title: "Properties for Rent in Hat Yai",
  description:
    "Browse condos, apartments, houses and townhouses for rent in Hat Yai. Filter by location, budget, bedrooms and more.",
};

export default function PropertiesPage() {
  return (
    <Container className="py-10 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">
          Find a place that's right for you.
        </h1>
        <p className="mt-3 text-ink-soft">
          Browse our selected rental listings across Hat Yai, or use the filters to
          narrow things down by location, budget and property type.
        </p>
      </div>

      <div className="mt-8">
        <PropertiesExplorer properties={properties} />
      </div>
    </Container>
  );
}
