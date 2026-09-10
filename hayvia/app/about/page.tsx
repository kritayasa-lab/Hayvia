import type { Metadata } from "next";
import Image from "next/image";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "About",
  description:
    "HAYVIA helps people discover selected rental properties in Hat Yai and connect with local property owners and agents.",
};

const values = [
  {
    title: "Selected, not exhaustive",
    description:
      "We don't try to list every property in Hat Yai. We'd rather show fewer, clearer listings than an overwhelming, unverified feed.",
  },
  {
    title: "Matching is manual, for now",
    description:
      "A real person reviews every Get Matched submission. We're not claiming automated AI matching — we think a human reviewing your needs does better work at this stage.",
  },
  {
    title: "We're a connector, not the landlord",
    description:
      "HAYVIA doesn't own the properties listed here. We help you find suitable options and connect you with the property owner or agent who manages them.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Container className="py-10 sm:py-14">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
              A simpler way to find your place in Hat Yai.
            </h1>
            <p className="mt-5 leading-relaxed text-ink-soft">
              HAYVIA helps people discover selected rental properties in Hat Yai and
              connect with local property owners and agents. We built this for anyone
              who's ever tried to rent a place in a new city and found the process
              scattered across Facebook groups, word of mouth and listings with missing
              information.
            </p>
            <p className="mt-4 leading-relaxed text-ink-soft">
              Our focus is long-term rentals for international tenants — Malaysian and
              Singaporean visitors, students, professionals and families relocating to
              Hat Yai — as well as Thai customers looking for a clearer rental process.
            </p>
            <Button href="/get-matched" className="mt-6">
              Get Matched
            </Button>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded">
            <Image
              src="https://picsum.photos/seed/hayvia-about/900/700"
              alt="A Hat Yai street scene"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>

      <section className="border-t border-line bg-surface py-14 sm:py-20">
        <Container>
          <SectionHeading title="How we think about this" align="center" className="mx-auto" />
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            {values.map((value) => (
              <div key={value.title}>
                <h3 className="font-display text-lg text-ink">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Container className="py-14 sm:py-20">
        <div className="mx-auto max-w-2xl rounded border border-line bg-surface p-8 text-center">
          <p className="font-display text-xl text-ink">Have a property to list?</p>
          <p className="mt-2 text-sm text-ink-soft">
            We're always reviewing new properties from owners and agents across Hat Yai.
          </p>
          <Button href="/list-your-property" variant="secondary" className="mt-5">
            List Your Property
          </Button>
        </div>
      </Container>
    </>
  );
}
