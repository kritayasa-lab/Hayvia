"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  FieldWrapper,
  TextInput,
  TextArea,
  Select,
  RadioPillGroup,
} from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { submitLead, type GetMatchedLead } from "@/lib/leads";

type FormState = Omit<GetMatchedLead, "source" | "submittedAt">;

const initialState: FormState = {
  name: "",
  nationality: "",
  contactMethod: "WhatsApp",
  contactInfo: "",
  propertyType: "Not sure",
  preferredArea: "",
  budget: "",
  bedrooms: "No preference",
  furnished: "No preference",
  parking: "Not important",
  moveInDate: "",
  rentalDuration: "",
  occupants: "",
  additionalRequirements: "",
};

const requiredFields: Array<keyof FormState> = [
  "name",
  "nationality",
  "contactInfo",
  "preferredArea",
  "budget",
  "rentalDuration",
  "occupants",
];

export default function GetMatchedForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    for (const field of requiredFields) {
      if (!form[field] || String(form[field]).trim() === "") {
        nextErrors[field] = "This field is required.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      const firstError = document.querySelector("[data-error='true']");
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setStatus("submitting");
    setSubmitError(null);
    const result = await submitLead({
      source: "get-matched",
      submittedAt: new Date().toISOString(),
      ...form,
    });

    if (result.success) {
      setStatus("success");
    } else {
      setStatus("idle");
      setSubmitError(result.message);
    }
  }

  if (status === "success") {
    return (
      <div className="rounded border border-moss-100 bg-moss-50 p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto mb-4 text-moss-600" size={36} />
        <h2 className="font-display text-2xl text-ink">Thank you!</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          We've received your requirements. We'll review suitable properties and contact
          you with available options.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10" noValidate>
      <FormSection title="About you">
        <FieldWrapper label="Name" htmlFor="gm-name" required error={errors.name}>
          <TextInput
            id="gm-name"
            data-error={Boolean(errors.name)}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            error={Boolean(errors.name)}
            placeholder="Your full name"
          />
        </FieldWrapper>

        <FieldWrapper label="Nationality" htmlFor="gm-nationality" required error={errors.nationality}>
          <Select
            id="gm-nationality"
            data-error={Boolean(errors.nationality)}
            value={form.nationality}
            onChange={(e) => update("nationality", e.target.value)}
            error={Boolean(errors.nationality)}
          >
            <option value="">Select nationality</option>
            <option>Thailand</option>
            <option>Malaysia</option>
            <option>Singapore</option>
            <option>China</option>
            <option>Other</option>
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Contact method" htmlFor="gm-contact-method" required className="sm:col-span-2">
          <RadioPillGroup
            name="contactMethod"
            options={["WhatsApp", "LINE", "Email"]}
            value={form.contactMethod}
            onChange={(v) => update("contactMethod", v)}
          />
        </FieldWrapper>

        <FieldWrapper
          label="Contact information"
          htmlFor="gm-contact-info"
          required
          error={errors.contactInfo}
          hint={`Enter your ${form.contactMethod} number or address`}
        >
          <TextInput
            id="gm-contact-info"
            data-error={Boolean(errors.contactInfo)}
            value={form.contactInfo}
            onChange={(e) => update("contactInfo", e.target.value)}
            error={Boolean(errors.contactInfo)}
            placeholder={form.contactMethod === "Email" ? "you@example.com" : "+60 1X XXX XXXX"}
          />
        </FieldWrapper>
      </FormSection>

      <FormSection title="What you're looking for">
        <FieldWrapper label="Property type" htmlFor="gm-property-type" className="sm:col-span-2">
          <RadioPillGroup
            name="propertyType"
            options={["Condo", "Apartment", "House", "Townhouse", "Not sure"]}
            value={form.propertyType}
            onChange={(v) => update("propertyType", v)}
          />
        </FieldWrapper>

        <FieldWrapper label="Preferred area" htmlFor="gm-area" required error={errors.preferredArea}>
          <Select
            id="gm-area"
            data-error={Boolean(errors.preferredArea)}
            value={form.preferredArea}
            onChange={(e) => update("preferredArea", e.target.value)}
            error={Boolean(errors.preferredArea)}
          >
            <option value="">Select an area</option>
            <option>Central Hat Yai</option>
            <option>Hat Yai University / PSU area</option>
            <option>Khlong Hae</option>
            <option>Kho Hong</option>
            <option>Other</option>
            <option>I'm not sure</option>
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Monthly budget" htmlFor="gm-budget" required error={errors.budget}>
          <Select
            id="gm-budget"
            data-error={Boolean(errors.budget)}
            value={form.budget}
            onChange={(e) => update("budget", e.target.value)}
            error={Boolean(errors.budget)}
          >
            <option value="">Select a budget range</option>
            <option>Below ฿10,000</option>
            <option>฿10,000–15,000</option>
            <option>฿15,000–20,000</option>
            <option>฿20,000–30,000</option>
            <option>฿30,000+</option>
            <option>Flexible</option>
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Bedrooms" htmlFor="gm-bedrooms" className="sm:col-span-2">
          <RadioPillGroup
            name="bedrooms"
            options={["Studio", "1", "2", "3+", "No preference"]}
            value={form.bedrooms}
            onChange={(v) => update("bedrooms", v)}
          />
        </FieldWrapper>

        <FieldWrapper label="Furnished" htmlFor="gm-furnished" className="sm:col-span-2">
          <RadioPillGroup
            name="furnished"
            options={["Fully furnished", "Partially furnished", "Unfurnished", "No preference"]}
            value={form.furnished}
            onChange={(v) => update("furnished", v)}
          />
        </FieldWrapper>

        <FieldWrapper label="Parking" htmlFor="gm-parking" className="sm:col-span-2">
          <RadioPillGroup
            name="parking"
            options={["Required", "Preferred", "Not important"]}
            value={form.parking}
            onChange={(v) => update("parking", v)}
          />
        </FieldWrapper>
      </FormSection>

      <FormSection title="Timing">
        <FieldWrapper label="Move-in date" htmlFor="gm-movein">
          <TextInput
            id="gm-movein"
            type="date"
            value={form.moveInDate}
            onChange={(e) => update("moveInDate", e.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper
          label="Rental duration"
          htmlFor="gm-duration"
          required
          error={errors.rentalDuration}
        >
          <Select
            id="gm-duration"
            data-error={Boolean(errors.rentalDuration)}
            value={form.rentalDuration}
            onChange={(e) => update("rentalDuration", e.target.value)}
            error={Boolean(errors.rentalDuration)}
          >
            <option value="">Select duration</option>
            <option>1–3 months</option>
            <option>3–6 months</option>
            <option>6–12 months</option>
            <option>1 year+</option>
            <option>Not sure</option>
          </Select>
        </FieldWrapper>

        <FieldWrapper
          label="Number of occupants"
          htmlFor="gm-occupants"
          required
          error={errors.occupants}
        >
          <TextInput
            id="gm-occupants"
            data-error={Boolean(errors.occupants)}
            type="number"
            min={1}
            value={form.occupants}
            onChange={(e) => update("occupants", e.target.value)}
            error={Boolean(errors.occupants)}
            placeholder="e.g. 2"
          />
        </FieldWrapper>
      </FormSection>

      <FormSection title="Anything else?">
        <FieldWrapper label="Additional requirements" htmlFor="gm-additional" className="sm:col-span-2">
          <TextArea
            id="gm-additional"
            value={form.additionalRequirements}
            onChange={(e) => update("additionalRequirements", e.target.value)}
            placeholder="Pets, accessibility needs, specific building preferences, anything else worth knowing"
          />
        </FieldWrapper>
      </FormSection>

      {submitError && (
        <p role="alert" className="text-sm text-red-500">
          {submitError}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={status === "submitting"}>
        {status === "submitting" ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Submitting...
          </>
        ) : (
          "Find My Home"
        )}
      </Button>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line-soft pt-8 first:border-t-0 first:pt-0">
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>
    </div>
  );
}
