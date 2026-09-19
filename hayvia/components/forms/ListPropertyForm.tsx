"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { districts } from "@/data/properties";
import { FieldWrapper, TextInput, TextArea, Select } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { submitLead, type ListPropertyLead, type PreferredContactMethod } from "@/lib/leads";

type FormState = Omit<ListPropertyLead, "source" | "submittedAt">;

const initialState: FormState = {
  name: "",
  company: "",
  phone: "",
  email: "",
  propertyName: "",
  propertyType: "",
  district: "",
  expectedPrice: "",
  bedrooms: "",
  bathrooms: "",
  sizeSqm: "",
  availableDate: "",
  description: "",
  preferredContactMethod: "PHONE",
  lineId: "",
  whatsappNumber: "",
};

const requiredFields: Array<keyof FormState> = [
  "name",
  "phone",
  "email",
  "propertyName",
  "propertyType",
  "district",
  "expectedPrice",
  "description",
];

const contactMethodLabels: Record<PreferredContactMethod, string> = {
  PHONE: "Phone",
  LINE: "LINE",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

export default function ListPropertyForm() {
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
    if (form.email && !form.email.includes("@")) {
      nextErrors.email = "Please enter a valid email.";
    }
    if (form.preferredContactMethod === "LINE" && !form.lineId?.trim()) {
      nextErrors.lineId = "Please enter your LINE ID.";
    }
    if (form.preferredContactMethod === "WHATSAPP" && !form.whatsappNumber?.trim()) {
      nextErrors.whatsappNumber = "Please enter your WhatsApp number.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStatus("submitting");
    setSubmitError(null);
    const result = await submitLead({
      source: "list-your-property",
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
        <h2 className="font-display text-2xl text-ink">Thank you.</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          We&apos;ll review your property details and contact you if it is suitable for our
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

        <FieldWrapper label="District" htmlFor="lp-district" required error={errors.district}>
          <Select
            id="lp-district"
            value={form.district}
            onChange={(e) => update("district", e.target.value)}
            error={Boolean(errors.district)}
          >
            <option value="">Select district</option>
            {districts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Expected price (THB)" htmlFor="lp-price" required error={errors.expectedPrice}>
          <TextInput
            id="lp-price"
            value={form.expectedPrice}
            onChange={(e) => update("expectedPrice", e.target.value)}
            error={Boolean(errors.expectedPrice)}
            placeholder="e.g. 2500000"
          />
        </FieldWrapper>

        <FieldWrapper label="Bedrooms" htmlFor="lp-bedrooms" hint="Optional">
          <TextInput
            id="lp-bedrooms"
            type="number"
            min={0}
            value={form.bedrooms}
            onChange={(e) => update("bedrooms", e.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="Bathrooms" htmlFor="lp-bathrooms" hint="Optional">
          <TextInput
            id="lp-bathrooms"
            type="number"
            min={0}
            value={form.bathrooms}
            onChange={(e) => update("bathrooms", e.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="Size (sqm)" htmlFor="lp-size" hint="Optional">
          <TextInput
            id="lp-size"
            type="number"
            min={0}
            value={form.sizeSqm}
            onChange={(e) => update("sizeSqm", e.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="Available date" htmlFor="lp-available" hint="Optional">
          <TextInput
            id="lp-available"
            type="date"
            value={form.availableDate}
            onChange={(e) => update("availableDate", e.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="Preferred contact method" htmlFor="lp-contact-method" required>
          <Select
            id="lp-contact-method"
            value={form.preferredContactMethod}
            onChange={(e) => update("preferredContactMethod", e.target.value as PreferredContactMethod)}
          >
            {(Object.keys(contactMethodLabels) as PreferredContactMethod[]).map((method) => (
              <option key={method} value={method}>
                {contactMethodLabels[method]}
              </option>
            ))}
          </Select>
        </FieldWrapper>

        {form.preferredContactMethod === "LINE" && (
          <FieldWrapper label="LINE ID" htmlFor="lp-line-id" required error={errors.lineId}>
            <TextInput
              id="lp-line-id"
              value={form.lineId}
              onChange={(e) => update("lineId", e.target.value)}
              error={Boolean(errors.lineId)}
            />
          </FieldWrapper>
        )}

        {form.preferredContactMethod === "WHATSAPP" && (
          <FieldWrapper label="WhatsApp number" htmlFor="lp-whatsapp" required error={errors.whatsappNumber}>
            <TextInput
              id="lp-whatsapp"
              value={form.whatsappNumber}
              onChange={(e) => update("whatsappNumber", e.target.value)}
              error={Boolean(errors.whatsappNumber)}
            />
          </FieldWrapper>
        )}
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
          placeholder="Bedrooms, bathrooms, size, furnishing, amenities, anything a prospective buyer should know"
        />
      </FieldWrapper>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Photos</label>
        <div className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-line px-6 py-10 text-center">
          <ImagePlus className="text-ink-faint" size={24} />
          <p className="text-sm text-ink-soft">
            Photo upload isn&apos;t connected yet for this MVP.
          </p>
          <p className="text-xs text-ink-faint">
            We&apos;ll follow up with you directly to collect photos of your property.
          </p>
        </div>
      </div>

      {submitError && (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-500">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {submitError}
        </p>
      )}
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
