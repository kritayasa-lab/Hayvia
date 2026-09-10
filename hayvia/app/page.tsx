import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, FileText, Users, ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import PropertyGrid from "@/components/property/PropertyGrid";
import { getFeaturedProperties } from "@/data/properties";

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "Verified Listings",
    description:
      "Selected properties are reviewed before they're published, so what you see reflects what's actually available.",
  },
  {
    icon: FileText,
    title: "Clear Rental Information",
    description:
      "Price, deposit, lease terms and what's included are laid out upfront — no digging required.",
  },
  {
    icon: Users,
    title: "Personalized Matching",
    description:
      "Tell us your budget, area and must-haves, and we'll point you toward properties that actually fit.",
  },
];

const steps = [
  {
    number: "01",
    title: "Tell us what you need",
    description:
      "Share your budget, preferred area and requirements through our Get Matched form.",
  },
  {
    number: "02",
    title: "We find suitable options",
    description:
      "Our team reviews available properties and shortlists ones that fit what you're looking for.",
  },
  {
    number: "03",
    title: "Connect with the property owner or agent",
    description:
      "We introduce you directly to the owner or agent so you can view the property and finalize the details.",
  },
];

export default function HomePage() {
  const featured = getFeaturedProperties(6);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <Container className="grid grid-cols-1 gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-sm text-moss-700">Property • Living • Local Services</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.08] text-ink sm:text-5xl lg:text-[3.4rem]">
              Find Your Home in Hat Yai
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
              Discover carefully selected rental properties and get matched with a home
              that fits your budget, location and lifestyle.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/properties" size="lg">
                Browse Properties
              </Button>
              <Button href="/get-matched" size="lg" variant="secondary">
                Get Matched
              </Button>
            </div>
          </div>

          <div className="relative grid grid-cols-5 grid-rows-5 gap-3 sm:gap-4">
            <div className="relative col-span-3 row-span-3 overflow-hidden rounded">
              <Image
                src="https://picsum.photos/seed/hayvia-hero-main/900/900"
                alt="A furnished condo living room in Hat Yai"
                fill
                priority
                sizes="(max-width: 1024px) 60vw, 30vw"
                className="object-cover"
              />
            </div>
            <div className="relative col-span-2 col-start-4 row-span-2 overflow-hidden rounded">
              <Image
                src="https://picsum.photos/seed/hayvia-hero-2/500/500"
                alt="A residential street in Hat Yai"
                fill
                sizes="(max-width: 1024px) 30vw, 15vw"
                className="object-cover"
              />
            </div>
            <div className="relative col-span-2 col-start-4 row-span-3 row-start-3 overflow-hidden rounded">
              <Image
                src="https://picsum.photos/seed/hayvia-hero-3/500/700"
                alt="A modern condo building facade"
                fill
                sizes="(max-width: 1024px) 30vw, 15vw"
                className="object-cover"
              />
            </div>
            <div className="relative col-span-3 col-start-1 row-span-2 row-start-4 overflow-hidden rounded">
              <Image
                src="https://picsum.photos/seed/hayvia-hero-4/700/500"
                alt="A well-lit kitchen area in a Hat Yai rental unit"
                fill
                sizes="(max-width: 1024px) 60vw, 30vw"
                className="object-cover"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Trust */}
      <section className="py-14 sm:py-20">
        <Container>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
            {trustPoints.map((point) => (
              <div key={point.title}>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-moss-50 text-moss-700">
                  <point.icon size={20} />
                </span>
                <h3 className="mt-4 font-display text-lg text-ink">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Featured Properties */}
      <section className="border-t border-line py-14 sm:py-20">
        <Container>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="Featured"
              title="Selected properties in Hat Yai"
              description="A sample of the kind of listings we work with — furnished condos, family houses and everything in between."
            />
            <Link
              href="/properties"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-moss-700 hover:underline"
            >
              View all properties <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-10">
            <PropertyGrid properties={featured} />
          </div>
        </Container>
      </section>

      {/* How It Works */}
      <section className="border-t border-line bg-surface py-14 sm:py-20">
        <Container>
          <SectionHeading title="How it works" align="center" className="mx-auto" />
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            {steps.map((step) => (
              <div key={step.number} className="text-center sm:text-left">
                <p className="font-display text-3xl text-moss-300">{step.number}</p>
                <h3 className="mt-3 font-display text-lg text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Hat Yai Living */}
      <section className="border-t border-line py-14 sm:py-20">
        <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded">
            <Image
              src="https://picsum.photos/seed/hayvia-living/900/700"
              alt="A neighbourhood street scene in Hat Yai"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <SectionHeading
              eyebrow="Hat Yai Living"
              title="The right neighbourhood matters as much as the right unit"
              description="Central Hat Yai, Kho Hong, the PSU area and Khlong Hae each offer a different pace, price point and commute. Our guide breaks down what to expect from each so you can narrow things down before you start browsing."
            />
            <Button href="/guide" variant="secondary" className="mt-6">
              Read the Hat Yai Guide
            </Button>
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line bg-moss-900 py-16 sm:py-20">
        <Container className="text-center">
          <h2 className="font-display text-3xl text-white sm:text-4xl">
            Not sure where to start?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-moss-100/80">
            Tell us what you're looking for and we'll help you find suitable options.
          </p>
          <Button href="/get-matched" size="lg" className="mt-7 bg-white text-moss-900 hover:bg-moss-50">
            Get Matched
          </Button>
        </Container>
      </section>
    </>
  );
}
