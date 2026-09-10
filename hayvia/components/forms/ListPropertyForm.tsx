"use client";

import { useState } from "react";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { FieldWrapper, TextInput, TextArea, Select } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { submitLead, type ListPropertyLead } from "@/lib/leads";

type FormState = Omit<ListPropertyLead, "source" | "submittedAt">;

const initialState: FormState = {
  name: "",
  company: "",
  phone: "",
  email: "",
  propertyName: "",
  propertyType: "",
  location: "",
  monthlyRent: "",
  availableDate: "",
  description: "",
  contactMethod: "WhatsApp",
};

const requiredFields: Array<keyof FormState> = [
  "name",
  "phone",
  "email",
  "propertyName",
  "propertyType",
  "location",
  "monthlyRent",
  "description",
];

export default function ListPropertyForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

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
    if (form.email && !form.email.includes("@")) {
      nextErrors.email = "Please enter a valid email.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStatus("submitting");
    await submitLead({
      source: "list-your-property",
      submittedAt: new Date().toISOString(),
      ...form,
    });
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded border border-moss-100 bg-moss-50 p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto mb-4 text-moss-600" size={36} />
        <h2 className="font-display text-2xl text-ink">Thank you.</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          We'll review your property details and contact you if it is suitable for our
          platform.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FieldWrapper label="Name" htmlFor="lp-name" required error={errors.name}>
          <TextInput
            id="lp-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            error={Boolean(errors.name)}
          />
        </FieldWrapper>

        <FieldWrapper label="Company / Agency" htmlFor="lp-company" hint="Optional">
          <TextInput
            id="lp-company"
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="Phone" htmlFor="lp-phone" required error={errors.phone}>
          <TextInput
            id="lp-phone"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            error={Boolean(errors.phone)}
          />
        </FieldWrapper>

        <FieldWrapper label="Email" htmlFor="lp-email" required error={errors.email}>
          <TextInput
            id="lp-email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            error={Boolean(errors.email)}
          />
        </FieldWrapper>

        <FieldWrapper label="Property name" htmlFor="lp-propname" required error={errors.propertyName}>
          <TextInput
            id="lp-propname"
            value={form.propertyName}
            onChange={(e) => update("propertyName", e.target.value)}
            error={Boolean(errors.propertyName)}
            placeholder="e.g. Sunrise Condo, Unit 12B"
          />
        </FieldWrapper>

        <FieldWrapper label="Property type" htmlFor="lp-proptype" required error={errors.propertyType}>
          <Select
            id="lp-proptype"
            value={form.propertyType}
            onChange={(e) => update("propertyType", e.target.value)}
            error={Boolean(errors.propertyType)}
          >
            <option value="">Select type</option>
            <option>Condo</option>
            <option>Apartment</option>
            <option>House</option>
            <option>Townhouse</option>
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Location" htmlFor="lp-location" required error={errors.location}>
          <TextInput
            id="lp-location"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            error={Boolean(errors.location)}
            placeholder="e.g. Kho Hong, Hat Yai"
          />
        </FieldWrapper>

        <FieldWrapper label="Monthly rent" htmlFor="lp-rent" required error={errors.monthlyRent}>
          <TextInput
            id="lp-rent"
            value={form.monthlyRent}
            onChange={(e) => update("monthlyRent", e.target.value)}
            error={Boolean(errors.monthlyRent)}
            placeholder="e.g. 12000"
          />
        </FieldWrapper>

        <FieldWrapper label="Available date" htmlFor="lp-available">
          <TextInput
            id="lp-available"
            type="date"
            value={form.availableDate}
            onChange={(e) => update("availableDate", e.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="Preferred contact method" htmlFor="lp-contact-method">
          <Select
            id="lp-contact-method"
            value={form.contactMethod}
            onChange={(e) => update("contactMethod", e.target.value)}
          >
            <option>WhatsApp</option>
            <option>LINE</option>
            <option>Email</option>
            <option>Phone call</option>
          </Select>
        </FieldWrapper>
      </div>

      <FieldWrapper
        label="Property description"
        htmlFor="lp-description"
        required
        error={errors.description}
      >
        <TextArea
          id="lp-description"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          error={Boolean(errors.description)}
          placeholder="Bedrooms, bathrooms, size, furnishing, amenities, anything a prospective tenant should know"
        />
      </FieldWrapper>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Photos</label>
        <div className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-line px-6 py-10 text-center">
          <ImagePlus className="text-ink-faint" size={24} />
          <p className="text-sm text-ink-soft">
            Photo upload isn't connected yet for this MVP.
          </p>
          <p className="text-xs text-ink-faint">
            We'll follow up with you directly to collect photos of your property.
          </p>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={status === "submitting"}>
        {status === "submitting" ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Submitting...
          </>
        ) : (
          "Submit Property"
        )}
      </Button>
    </form>
  );
}
