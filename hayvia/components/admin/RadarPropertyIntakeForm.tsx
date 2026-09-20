"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { FieldWrapper, TextInput, TextArea, Select } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import Badge from "@/components/ui/Badge";
import {
  createManualCandidate,
  type RadarCandidateActionState,
} from "@/app/admin/(dashboard)/radar/properties/actions";

export default function RadarPropertyIntakeForm() {
  const [state, formAction] = useFormState(createManualCandidate, null);

  return (
    <form action={formAction} className="space-y-8">
      {/* Carries the raw record's id through a re-submission after a
          possible-duplicate warning, so the evidence row created on the
          first submit is never duplicated — see createManualCandidate(). */}
      {state?.rawId && <input type="hidden" name="raw_id" value={state.rawId} />}
      <FormMessage state={state} />

      {state?.duplicates && state.duplicates.length > 0 && (
        <div className="rounded border border-clay-200 bg-clay-50 p-4">
          <p className="text-sm font-medium text-ink">
            Possible duplicate{state.duplicates.length > 1 ? "s" : ""} found
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            The following open candidate{state.duplicates.length > 1 ? "s" : ""} already match this
            district, property type, bedrooms, and a similar price. Review before creating a new one.
          </p>
          <ul className="mt-3 space-y-2">
            {state.duplicates.map((dup) => (
              <li key={dup.id} className="flex items-center justify-between gap-3 rounded bg-surface px-3 py-2">
                <div className="text-sm">
                  <Link
                    href={`/admin/radar/properties/${dup.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-moss-700 hover:underline"
                  >
                    {dup.candidateCode}
                  </Link>
                  <span className="ml-2 text-ink-faint">
                    {[dup.propertyType, dup.district, dup.bedrooms != null ? `${dup.bedrooms} bed` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <Badge tone="neutral">{dup.status}</Badge>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            name="force_create"
            value="1"
            className="mt-4 rounded border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-ink/20 hover:text-ink"
          >
            Create anyway as a new candidate
          </button>
        </div>
      )}

      <section>
        <h3 className="font-display text-base text-ink">Source</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Source URL" htmlFor="source_url" hint="Optional — e.g. a listing link.">
            <TextInput id="source_url" name="source_url" type="url" placeholder="https://..." />
          </FieldWrapper>
          <FieldWrapper label="Source identifier" htmlFor="source_identifier" hint="Optional — e.g. a post/listing ID.">
            <TextInput id="source_identifier" name="source_identifier" />
          </FieldWrapper>
        </div>
      </section>

      <section>
        <h3 className="font-display text-base text-ink">Property facts</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldWrapper label="Property type" htmlFor="property_type" required>
            <Select id="property_type" name="property_type" defaultValue="CONDO">
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
          <FieldWrapper label="Province" htmlFor="province">
            <TextInput id="province" name="province" defaultValue="Songkhla" />
          </FieldWrapper>
          <FieldWrapper label="City" htmlFor="city" required>
            <TextInput id="city" name="city" defaultValue="Hat Yai" />
          </FieldWrapper>
          <FieldWrapper label="District" htmlFor="district" hint="Optional">
            <TextInput id="district" name="district" />
          </FieldWrapper>
          <FieldWrapper label="Price (THB)" htmlFor="price" hint="Optional — asking price if known.">
            <TextInput id="price" name="price" type="number" min={0} step="0.01" />
          </FieldWrapper>
          <FieldWrapper label="Bedrooms" htmlFor="bedrooms" hint="Optional">
            <TextInput id="bedrooms" name="bedrooms" type="number" min={0} />
          </FieldWrapper>
          <FieldWrapper label="Bathrooms" htmlFor="bathrooms" hint="Optional">
            <TextInput id="bathrooms" name="bathrooms" type="number" min={0} />
          </FieldWrapper>
          <FieldWrapper label="Size (sqm)" htmlFor="size_sqm" hint="Optional">
            <TextInput id="size_sqm" name="size_sqm" type="number" min={0} step="0.1" />
          </FieldWrapper>
        </div>
      </section>

      <FieldWrapper label="Description" htmlFor="description" required>
        <TextArea
          id="description"
          name="description"
          placeholder="What this property is, and why it might be worth acquiring/listing."
        />
      </FieldWrapper>

      <FieldWrapper
        label="Evidence / source notes"
        htmlFor="evidence_notes"
        hint="Optional — how this was found, anything else worth preserving as evidence."
      >
        <TextArea id="evidence_notes" name="evidence_notes" />
      </FieldWrapper>

      <SubmitButton pendingLabel="Saving...">Add Property Candidate</SubmitButton>
    </form>
  );
}
