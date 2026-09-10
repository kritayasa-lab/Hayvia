import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BedDouble, Bath, Ruler, Car, ShieldCheck, CheckCircle2 } from "lucide-react";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ImageGallery from "@/components/property/ImageGallery";
import InquiryPanel from "@/components/property/InquiryPanel";
import PropertyGrid from "@/components/property/PropertyGrid";
import { properties, getPropertyBySlug, getRelatedProperties } from "@/data/properties";
import { formatPrice, formatDate } from "@/lib/utils";

export function generateStaticParams() {
  return properties.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const property = getPropertyBySlug(params.slug);
  if (!property) return {};

  return {
    title: `${property.title} — ${formatPrice(property.price)}/month`,
    description: property.description,
    openGraph: {
      title: property.title,
      description: property.description,
      images: [property.images[0]],
    },
  };
}

export default function PropertyDetailPage({ params }: { params: { slug: string } }) {
  const property = getPropertyBySlug(params.slug);
  if (!property) notFound();

  const related = getRelatedProperties(property, 3);
  const bedroomLabel = property.bedrooms === 0 ? "Studio" : `${property.bedrooms} bedroom`;

  return (
    <Container className="py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-faint">
        <Link href="/properties" className="hover:text-ink">
          Properties
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-soft">{property.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        <div>
          <ImageGallery images={property.images} title={property.title} />

          <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {property.verified && (
                  <Badge tone="moss">
                    <ShieldCheck size={12} /> Verified Listing
                  </Badge>
                )}
                {property.status === "reserved" && <Badge tone="neutral">Reserved</Badge>}
              </div>
              <h1 className="mt-2 font-display text-2xl text-ink sm:text-3xl">
                {property.title}
              </h1>
              <p className="mt-1 text-ink-soft">{property.location}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl text-ink sm:text-3xl">
                {formatPrice(property.price)}
              </p>
              <p className="text-sm text-ink-faint">per month</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 rounded border border-line bg-surface p-5 sm:grid-cols-4">
            <Spec icon={BedDouble} label={bedroomLabel} />
            <Spec icon={Bath} label={`${property.bathrooms} bathroom`} />
            <Spec icon={Ruler} label={`${property.size} sqm`} />
            <Spec icon={Car} label={property.parking ? "Parking included" : "No parking"} />
          </div>

          <Section title="Overview">
            <p className="leading-relaxed text-ink-soft">{property.description}</p>
          </Section>

          <Section title="Property Features">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FeatureItem label={`Type: ${property.propertyType}`} />
              <FeatureItem label={`Furnished: ${property.furnished}`} />
              <FeatureItem label={property.parking ? "Private parking" : "No dedicated parking"} />
              <FeatureItem label={property.wifi ? "Wi-Fi included" : "Wi-Fi not included"} />
            </ul>
          </Section>

          <Section title="Amenities">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {property.amenities.map((amenity) => (
                <FeatureItem key={amenity} label={amenity} />
              ))}
            </ul>
          </Section>

          <Section title="Rental Terms">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TermItem label="Minimum lease" value={property.minimumLease} />
              <TermItem label="Deposit" value={property.deposit} />
              <TermItem label="Available from" value={formatDate(property.availableDate)} />
              <TermItem
                label="Preferred contact"
                value={property.contactType}
              />
            </dl>
          </Section>

          <Section title="Location">
            <p className="leading-relaxed text-ink-soft">
              {property.location}, {property.district}. Exact building details are shared
              once we connect you with the property owner or agent.
            </p>
          </Section>

          <Section title="Important Information">
            <p className="text-sm leading-relaxed text-ink-faint">
              This listing is a selected property shared on behalf of a local property
              owner or agent. Property availability, pricing and rental terms may change
              — please confirm current details before making any decisions. HAYVIA does
              not own or manage this property.
            </p>
          </Section>
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <InquiryPanel propertySlug={property.slug} propertyTitle={property.title} />

          <div className="mt-6 rounded border border-line-soft bg-surface p-5">
            <p className="text-sm font-medium text-ink">Looking for something similar?</p>
            <p className="mt-1.5 text-sm text-ink-soft">
              Tell us your requirements and we'll suggest other suitable options.
            </p>
            <Button href="/get-matched" variant="secondary" className="mt-4 w-full">
              Get Matched
            </Button>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-16 border-t border-line pt-12">
          <h2 className="font-display text-2xl text-ink">You might also like</h2>
          <div className="mt-8">
            <PropertyGrid properties={related} />
          </div>
        </div>
      )}
    </Container>
  );
}

function Spec({ icon: Icon, label }: { icon: typeof BedDouble; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-soft">
      <Icon size={16} className="text-moss-700" />
      {label}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 border-t border-line-soft pt-8">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function FeatureItem({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-ink-soft">
      <CheckCircle2 size={16} className="flex-shrink-0 text-moss-500" />
      {label}
    </li>
  );
}

function TermItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}
