import { fetchOwners, fetchAgents } from "@/lib/admin/people";
import { createAdminClient } from "@/lib/supabase/admin";
import PropertyForm, { type PropertyFormValues } from "@/components/admin/PropertyForm";
import AdminCard from "@/components/admin/AdminCard";
import { createProperty } from "@/app/admin/(dashboard)/properties/actions";

export const dynamic = "force-dynamic";

/**
 * Phase 7 — "Approve & Create Property" pre-fill. Maps only property-shaped
 * fields (specs/location) from the seller lead — never the seller's own
 * contact info (name/email/phone), which has no equivalent field on
 * `properties` and must never end up there. `status` is always DRAFT here;
 * moving it to PENDING_REVIEW/PUBLISHED stays a separate, later, manual
 * admin action on the property's own edit page.
 */
function propertyInitialFromSellerLead(sellerLead: {
  property_type: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  expected_price: number | null;
  description: string | null;
  additional_info: string | null;
}): Partial<PropertyFormValues> {
  const description = [sellerLead.description, sellerLead.additional_info].filter(Boolean).join("\n\n");

  return {
    status: "DRAFT",
    listing_type: "BUY", // a Seller Lead is inherently a for-sale submission
    property_type: sellerLead.property_type ?? undefined,
    province: sellerLead.province ?? undefined,
    city: sellerLead.city ?? undefined,
    district: sellerLead.district ?? undefined,
    bedrooms: sellerLead.bedrooms ?? undefined,
    bathrooms: sellerLead.bathrooms ?? undefined,
    size_sqm: sellerLead.size_sqm ?? undefined,
    // The seller's own asking price — a starting point, not a verified
    // final price. Admin can and should review/edit it before publishing.
    price: sellerLead.expected_price ?? undefined,
    description: description || undefined,
  };
}

/**
 * Phase 8C — "Approve & Create Property" pre-fill from a Property Radar
 * candidate. Same posture as the Seller Lead version: only property-shaped
 * fields, `status` always DRAFT (never auto-published), admin reviews/edits
 * before saving. radar_property_candidates has no listing_type of its own
 * (a candidate doesn't yet capture rent-vs-sale intent), so that's left at
 * PropertyForm's own default for the admin to set explicitly.
 */
function propertyInitialFromRadarCandidate(candidate: {
  property_type: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  price: number | null;
  description: string | null;
}): Partial<PropertyFormValues> {
  return {
    status: "DRAFT",
    property_type: candidate.property_type ?? undefined,
    province: candidate.province ?? undefined,
    city: candidate.city ?? undefined,
    district: candidate.district ?? undefined,
    bedrooms: candidate.bedrooms ?? undefined,
    bathrooms: candidate.bathrooms ?? undefined,
    size_sqm: candidate.size_sqm ?? undefined,
    // The candidate's own price facts — a starting point, not a verified
    // final price. Admin can and should review/edit it before publishing.
    price: candidate.price ?? undefined,
    description: candidate.description ?? undefined,
  };
}

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: { fromSellerLead?: string; fromRadarCandidate?: string };
}) {
  const [owners, agents] = await Promise.all([fetchOwners(), fetchAgents()]);

  let initial: Partial<PropertyFormValues> | undefined;
  let sellerLeadId: string | undefined;
  let radarCandidateId: string | undefined;

  if (searchParams.fromSellerLead) {
    const supabase = createAdminClient();
    const { data: sellerLead } = await supabase
      .from("seller_leads")
      .select("id, property_type, province, city, district, bedrooms, bathrooms, size_sqm, expected_price, description, additional_info")
      .eq("id", searchParams.fromSellerLead)
      .maybeSingle();

    if (sellerLead) {
      initial = propertyInitialFromSellerLead(sellerLead);
      sellerLeadId = sellerLead.id;
    }
  } else if (searchParams.fromRadarCandidate) {
    const supabase = createAdminClient();
    const { data: candidate } = await supabase
      .from("radar_property_candidates")
      .select("id, property_type, province, city, district, bedrooms, bathrooms, size_sqm, price, description")
      .eq("id", searchParams.fromRadarCandidate)
      .maybeSingle();

    if (candidate) {
      initial = propertyInitialFromRadarCandidate(candidate);
      radarCandidateId = candidate.id;
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">New Property</h1>
      <p className="mt-1 text-sm text-ink-faint">
        {sellerLeadId
          ? "Pre-filled from a Seller Lead submission — review and edit before saving."
          : radarCandidateId
            ? "Pre-filled from a Property Radar candidate — review and edit before saving."
            : "Images and amenities can be added once the property is created."}
      </p>
      <div className="mt-6 max-w-3xl">
        <AdminCard>
          <PropertyForm
            action={createProperty}
            initial={initial}
            owners={owners}
            agents={agents}
            submitLabel="Create Property"
            sellerLeadId={sellerLeadId}
            radarCandidateId={radarCandidateId}
          />
        </AdminCard>
      </div>
    </div>
  );
}
