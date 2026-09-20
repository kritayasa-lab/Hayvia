"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput, TextArea, Select } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import type { PropertyActionState } from "@/app/admin/(dashboard)/properties/actions";

export interface PropertyFormValues {
  listing_type: string;
  status: string;
  title: string;
  slug: string;
  property_type: string;
  description: string;
  price: number | string;
  currency: string;
  rental_period: string | null;
  bedrooms: number | string;
  bathrooms: number | string;
  size_sqm: number | string;
  furnished: string | null;
  parking: boolean;
  wifi: boolean;
  available_date: string;
  minimum_rental: string;
  deposit: string;
  country: string;
  province: string;
  city: string;
  district: string;
  subdistrict: string;
  google_maps_url: string;
  verified: boolean;
  featured: boolean;
  price_reduced: boolean;
  owner_id: string;
  agent_id: string;
  source: string;
  source_url: string;
  commission_type: string | null;
  commission_value: number | string;
  private_notes: string;
}

const emptyValues: PropertyFormValues = {
  listing_type: "RENT",
  status: "DRAFT",
  title: "",
  slug: "",
  property_type: "CONDO",
  description: "",
  price: "",
  currency: "THB",
  rental_period: "MONTHLY",
  bedrooms: "",
  bathrooms: "",
  size_sqm: "",
  furnished: "",
  parking: false,
  wifi: false,
  available_date: "",
  minimum_rental: "",
  deposit: "",
  country: "Thailand",
  province: "Songkhla",
  city: "Hat Yai",
  district: "",
  subdistrict: "",
  google_maps_url: "",
  verified: false,
  featured: false,
  price_reduced: false,
  owner_id: "",
  agent_id: "",
  source: "",
  source_url: "",
  commission_type: "",
  commission_value: "",
  private_notes: "",
};

export default function PropertyForm({
  action,
  initial,
  owners,
  agents,
  submitLabel,
  sellerLeadId,
  radarCandidateId,
}: {
  action: (state: PropertyActionState | null, formData: FormData) => Promise<PropertyActionState>;
  initial?: Partial<PropertyFormValues>;
  owners: { id: string; name: string }[];
  agents: { id: string; name: string }[];
  submitLabel: string;
  /**
   * Phase 7 — when creating a property from a Seller Lead's "Approve &
   * Create Property" action, carries the seller lead's id through this
   * form's own submission as a hidden field, so createProperty() can link
   * properties.seller_lead_id and mark the seller lead CONVERTED without
   * this form needing to know anything about that flow itself. Never
   * rendered on the edit form (no caller passes it there today), so an
   * existing property's traceability link can't be altered by resubmitting
   * the edit form.
   */
  sellerLeadId?: string;
  /**
   * Phase 8C — same pattern as sellerLeadId, for a property created from a
   * Property Radar candidate's "Approve & Create Property" action. Carries
   * the candidate's id so createProperty() can link
   * properties.radar_property_candidate_id and mark the candidate CONVERTED.
   * Never rendered on the edit form, for the same reason as sellerLeadId.
   */
  radarCandidateId?: string;
}) {
  const [state, formAction] = useFormState(action, null);
  const values = { ...emptyValues, ...initial };

  return (
    <form action={formAction} className="space-y-8">
      {sellerLeadId && <input type="hidden" name="seller_lead_id" value={sellerLeadId} />}
      {radarCandidateId && <input type="hidden" name="radar_property_candidate_id" value={radarCandidateId} />}
      <FormMessage state={state} />

      <section>
        <h3 className="font-display text-base text-ink">Basics</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Title" htmlFor="title" required className="sm:col-span-2">
            <TextInput id="title" name="title" defaultValue={values.title} required />
          </FieldWrapper>
          <FieldWrapper
            label="URL Slug"
            htmlFor="slug"
            hint="Leave blank to auto-generate from the title."
            className="sm:col-span-2"
          >
            <TextInput id="slug" name="slug" defaultValue={values.slug} placeholder="auto-generated" />
          </FieldWrapper>
          <FieldWrapper label="Listing Type" htmlFor="listing_type" required>
            <Select id="listing_type" name="listing_type" defaultValue={values.listing_type}>
              <option value="RENT">Rent</option>
              <option value="BUY">Sell / Buy</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Property Type" htmlFor="property_type" required>
            <Select id="property_type" name="property_type" defaultValue={values.property_type}>
              <option value="CONDO">Condo</option>
              <option value="APARTMENT">Apartment</option>
              <option value="HOUSE">House</option>
              <option value="TOWNHOUSE">Townhouse</option>
              <option value="VILLA">Villa</option>
              <option value="LAND">Land</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="OTHER">Other</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Status" htmlFor="status" required>
            <Select id="status" name="status" defaultValue={values.status}>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="PUBLISHED">Published</option>
              <option value="RESERVED">Reserved</option>
              <option value="RENTED">Rented</option>
              <option value="SOLD">Sold</option>
              <option value="HIDDEN">Hidden</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </FieldWrapper>
          <div className="flex flex-wrap items-center gap-5 sm:col-span-2">
            <Checkbox name="featured" label="Featured" defaultChecked={values.featured} />
            <Checkbox name="price_reduced" label="Price Reduced" defaultChecked={values.price_reduced} />
            <Checkbox name="verified" label="Verified Listing" defaultChecked={values.verified} />
          </div>
          <FieldWrapper label="Description" htmlFor="description" className="sm:col-span-2">
            <TextArea
              id="description"
              name="description"
              defaultValue={values.description}
              placeholder="Public-facing description shown on the property page."
            />
          </FieldWrapper>
        </div>
      </section>

      <section>
        <h3 className="font-display text-base text-ink">Pricing</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldWrapper label="Price" htmlFor="price" required>
            <TextInput id="price" name="price" type="number" min={0} step="0.01" defaultValue={values.price} required />
          </FieldWrapper>
          <FieldWrapper label="Currency" htmlFor="currency">
            <TextInput id="currency" name="currency" defaultValue={values.currency} maxLength={3} />
          </FieldWrapper>
          <FieldWrapper label="Rental Period" htmlFor="rental_period" hint="Only used for Rent listings.">
            <Select id="rental_period" name="rental_period" defaultValue={values.rental_period ?? ""}>
              <option value="">—</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Minimum Lease / Rental" htmlFor="minimum_rental">
            <TextInput id="minimum_rental" name="minimum_rental" defaultValue={values.minimum_rental} placeholder="e.g. 6 months" />
          </FieldWrapper>
          <FieldWrapper label="Deposit" htmlFor="deposit">
            <TextInput id="deposit" name="deposit" defaultValue={values.deposit} placeholder="e.g. 2 months rent" />
          </FieldWrapper>
          <FieldWrapper label="Available From" htmlFor="available_date">
            <TextInput id="available_date" name="available_date" type="date" defaultValue={values.available_date} />
          </FieldWrapper>
        </div>
      </section>

      <section>
        <h3 className="font-display text-base text-ink">Specifications</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldWrapper label="Bedrooms" htmlFor="bedrooms" hint="0 = studio">
            <TextInput id="bedrooms" name="bedrooms" type="number" min={0} defaultValue={values.bedrooms} />
          </FieldWrapper>
          <FieldWrapper label="Bathrooms" htmlFor="bathrooms">
            <TextInput id="bathrooms" name="bathrooms" type="number" min={0} defaultValue={values.bathrooms} />
          </FieldWrapper>
          <FieldWrapper label="Size (sqm)" htmlFor="size_sqm">
            <TextInput id="size_sqm" name="size_sqm" type="number" min={0} step="0.1" defaultValue={values.size_sqm} />
          </FieldWrapper>
          <FieldWrapper label="Furnished" htmlFor="furnished">
            <Select id="furnished" name="furnished" defaultValue={values.furnished ?? ""}>
              <option value="">—</option>
              <option value="FULLY_FURNISHED">Fully furnished</option>
              <option value="PARTIALLY_FURNISHED">Partially furnished</option>
              <option value="UNFURNISHED">Unfurnished</option>
            </Select>
          </FieldWrapper>
          <div className="flex items-center gap-5">
            <Checkbox name="parking" label="Parking" defaultChecked={values.parking} />
            <Checkbox name="wifi" label="Wi-Fi" defaultChecked={values.wifi} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-display text-base text-ink">Location</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldWrapper label="Country" htmlFor="country" required>
            <TextInput id="country" name="country" defaultValue={values.country} required />
          </FieldWrapper>
          <FieldWrapper label="Province" htmlFor="province" required>
            <TextInput id="province" name="province" defaultValue={values.province} required />
          </FieldWrapper>
          <FieldWrapper label="City" htmlFor="city" required>
            <TextInput id="city" name="city" defaultValue={values.city} required />
          </FieldWrapper>
          <FieldWrapper label="District / Area" htmlFor="district">
            <TextInput id="district" name="district" defaultValue={values.district} />
          </FieldWrapper>
          <FieldWrapper label="Subdistrict" htmlFor="subdistrict">
            <TextInput id="subdistrict" name="subdistrict" defaultValue={values.subdistrict} />
          </FieldWrapper>
          <FieldWrapper label="Google Maps URL" htmlFor="google_maps_url" className="sm:col-span-3">
            <TextInput
              id="google_maps_url"
              name="google_maps_url"
              type="url"
              defaultValue={values.google_maps_url}
              placeholder="https://www.google.com/maps/..."
            />
          </FieldWrapper>
        </div>
      </section>

      <section>
        <h3 className="font-display text-base text-ink">Private — Owner, Agent &amp; Commission</h3>
        <p className="mt-1 text-xs text-ink-faint">
          Never shown on the public website. Visible to admin only.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Owner" htmlFor="owner_id">
            <Select id="owner_id" name="owner_id" defaultValue={values.owner_id}>
              <option value="">— Not set —</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Agent" htmlFor="agent_id">
            <Select id="agent_id" name="agent_id" defaultValue={values.agent_id}>
              <option value="">— Not set —</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Source" htmlFor="source" hint="e.g. Direct owner, referral, Sheets import">
            <TextInput id="source" name="source" defaultValue={values.source} />
          </FieldWrapper>
          <FieldWrapper label="Source URL" htmlFor="source_url">
            <TextInput id="source_url" name="source_url" type="url" defaultValue={values.source_url} />
          </FieldWrapper>
          <FieldWrapper label="Commission Type" htmlFor="commission_type">
            <Select id="commission_type" name="commission_type" defaultValue={values.commission_type ?? ""}>
              <option value="">—</option>
              <option value="PERCENT">Percent</option>
              <option value="FIXED">Fixed</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Commission Value" htmlFor="commission_value">
            <TextInput
              id="commission_value"
              name="commission_value"
              type="number"
              min={0}
              step="0.01"
              defaultValue={values.commission_value}
            />
          </FieldWrapper>
          <FieldWrapper label="Private Notes" htmlFor="private_notes" className="sm:col-span-2">
            <TextArea id="private_notes" name="private_notes" defaultValue={values.private_notes} />
          </FieldWrapper>
        </div>
      </section>

      <div className="border-t border-line-soft pt-6">
        <SubmitButton pendingLabel="Saving...">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-line text-moss-600 focus:ring-moss-500/30"
      />
      {label}
    </label>
  );
}
