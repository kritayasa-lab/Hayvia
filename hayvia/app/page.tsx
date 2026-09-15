import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building, Building2, Home as HomeIcon, MapPin, Warehouse } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import SearchBar from "@/components/ui/SearchBar";
import PropertyGrid from "@/components/property/PropertyGrid";
import GuideCard from "@/components/guide/GuideCard";
import { districts, propertyTypes, type Property, type PropertyType } from "@/data/properties";
import { guides } from "@/data/guides";
import { getProperties, getMostViewedProperties } from "@/lib/properties-source";

const propertyTypeIcons: Record<PropertyType, typeof Building2> = {
  Condo: Building2,
  Apartment: Building,
  House: HomeIcon,
  Townhouse: Warehouse,
};

// Real counts per type, computed from whatever properties are currently
// loaded (Google Sheets or the local fallback) — never a fixed/invented list.
function getPropertyTypeCounts(properties: Property[]) {
  return propertyTypes
    .map((type) => ({
      type,
      count: properties.filter((p) => p.propertyType === type).length,
    }))
    .filter((entry) => entry.count > 0);
}

// Real counts per district, computed the same way, so "Popular Locations"
// only ever shows districts that actually have listings right now.
function getPopularLocations(properties: Property[], limit = 4) {
  return districts
    .map((district) => ({
      district,
      count: properties.filter((p) => p.district === district).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export default async function HomePage() {
  const { properties } = await getProperties();
  const featured = getMostViewedProperties(properties, 6);
  const typeCounts = getPropertyTypeCounts(properties);
  const popularLocations = getPopularLocations(properties);
  const latestGuides = guides.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line bg-warm-ivory">
        <Container className="py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm text-moss-700">Property • Living • Local Services</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] text-ink sm:text-5xl lg:text-[3.4rem]">
              Find a place that feels like home.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
              Carefully selected rental and sale properties in Hat Yai, matched to your
              budget, location and lifestyle.
            </p>
          </div>

          {/*
            Rent / Buy / Sell live inside SearchBar as tabs — Rent and Buy
            set the listing-type filter and search /properties for real
            (see SearchBar.tsx); Sell links straight to /list-your-property.
            This replaces the previous separate "Browse Properties" /
            "List Your Property" button pair so there's one CTA mechanism,
            not two overlapping ones.
          */}
          <div className="mx-auto mt-10 max-w-3xl">
            <SearchBar />
          </div>

          <div className="relative mx-auto mt-12 grid aspect-[16/7] max-w-5xl grid-cols-2 grid-rows-2 gap-4 sm:grid-cols-3 sm:grid-rows-1 sm:gap-5">
            <div className="relative row-span-2 overflow-hidden rounded-2xl bg-line-soft sm:row-span-1">
              <Image
                src="/images/hero-living-room.jpg"
                alt="A warm, minimal living room with light oak furniture and linen textiles"
                fill
                priority
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-line-soft">
              <Image
                src="/images/hero-bedroom.jpg"
                alt="A calm, minimal bedroom with natural light and neutral linen bedding"
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 30vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-line-soft">
              <Image
                src="/images/hero-dining.jpg"
                alt="A minimal dining nook with light oak wood and warm natural lighting"
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 30vw, 33vw"
                className="object-cover"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Explore Properties */}
      {typeCounts.length > 0 && (
        <section className="py-14 sm:py-20">
          <Container>
            <SectionHeading eyebrow="Explore" title="Browse by property type" />
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
              {typeCounts.map(({ type, count }) => {
                const Icon = propertyTypeIcons[type];
                return (
                  <Link
                    key={type}
                    href="/properties"
                    className="group flex flex-col items-start gap-4 rounded-2xl border border-seashell bg-white p-5 shadow-card transition-shadow hover:shadow-lg sm:p-6"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-linden-leaf text-moss-700">
                      <Icon size={20} />
                    </span>
                    <div>
                      <p className="font-display text-lg text-ink">{type}s</p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {count} {count === 1 ? "listing" : "listings"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Container>
        </section>
      )}

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

      {/*
        Recently Reduced — intentionally omitted. The Property data model
        (data/properties.ts) and the Google Sheets integration
        (lib/properties-source.ts) have no previous-price / price-history
        field, so there is no real reduction data to show. Fabricating one
        would violate the "no invented data" requirement. Add a section here
        once a real price-history field exists in the schema.
      */}

      {/* Popular Locations */}
      {popularLocations.length > 0 && (
        <section className="border-t border-line bg-kiwi-cream/40 py-14 sm:py-20">
          <Container>
            <SectionHeading eyebrow="Areas" title="Popular locations in Hat Yai" />
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
              {popularLocations.map(({ district, count }) => (
                <Link
                  key={district}
                  href="/properties"
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-seashell bg-white p-5 transition-colors hover:border-matcha-mist"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linden-leaf text-moss-700">
                      <MapPin size={17} />
                    </span>
                    <div>
                      <p className="font-medium text-ink">{district}</p>
                      <p className="text-sm text-ink-soft">
                        {count} {count === 1 ? "listing" : "listings"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={16}
                    className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Find Your Property Match */}
      <section className="border-t border-line py-14 sm:py-20">
        <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src="/images/hero-bedroom.jpg"
              alt="A calm, minimal bedroom with natural light and neutral linen bedding"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <SectionHeading
              eyebrow="Personalized"
              title="Find your property match"
              description="Not sure where to start? Tell us your budget, preferred area and must-haves, and we'll point you toward properties that actually fit — no endless scrolling required."
            />
            {/*
              Product architecture calls for /find-your-property — that
              route doesn't exist yet (this checkpoint intentionally
              doesn't create it), so this link will 404 until it's built.
              Not substituted with /get-matched per explicit instruction.
            */}
            <Button
              href="/find-your-property"
              size="lg"
              className="mt-6 bg-matcha-mist hover:opacity-90"
            >
              Find Your Match
            </Button>
          </div>
        </Container>
      </section>

      {/* Property Insights / News & Guides */}
      {latestGuides.length > 0 && (
        <section className="border-t border-line bg-surface py-14 sm:py-20">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                eyebrow="Insights"
                title="Hat Yai property guides"
                description="Practical, beginner-friendly reading on neighbourhoods, costs and what to check before you sign a lease."
              />
              <Link
                href="/guide"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-moss-700 hover:underline"
              >
                View all guides <ArrowRight size={15} />
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latestGuides.map((article) => (
                <GuideCard key={article.slug} article={article} />
              ))}
            </div>
          </Container>
        </section>
      )}

      {/*
        Sell / List Your Property CTA. Uses Old Copper as this section's
        accent — deliberately the one place on the page that departs from
        the green "rent/buy" identity, to visually separate the sell/list
        action. Kept to this single section per the "very limited
        copper/brown" balance.
      */}
      <section className="border-t border-line bg-old-copper py-16 sm:py-20">
        <Container className="text-center">
          <h2 className="font-display text-3xl text-white sm:text-4xl">
            Have a property in Hat Yai?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-white/80">
            List it with us and reach tenants and buyers looking for exactly what you
            offer. Every submission is reviewed before it goes live.
          </p>
          <Button
            href="/list-your-property"
            size="lg"
            className="mt-7 bg-white text-old-copper hover:bg-warm-ivory"
          >
            List Your Property
          </Button>
        </Container>
      </section>
    </>
  );
}
