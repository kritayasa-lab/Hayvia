"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { submitLead } from "@/lib/leads";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  additionalRequirements: string;
}

const initialState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  whatsapp: "",
  additionalRequirements: "",
};

export default function InquiryForm({
  propertySlug,
  propertyTitle,
}: {
  propertySlug: string;
  propertyTitle: string;
}) {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) nextErrors.firstName = "Please enter your first name.";
    if (!form.lastName.trim()) nextErrors.lastName = "Please enter your last name.";
    if (!form.email.trim() || !form.email.includes("@"))
      nextErrors.email = "Please enter a valid email.";
    if (!form.whatsapp.trim()) nextErrors.whatsapp = "Please enter a phone or WhatsApp number.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setStatus("submitting");
    setSubmitError(null);
    const result = await submitLead({
      source: "property-inquiry",
      submittedAt: new Date().toISOString(),
      propertySlug,
      propertyTitle,
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
      <div className="rounded border border-linden-leaf bg-kiwi-cream p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 text-moss-700" size={28} />
        <p className="font-display text-lg text-ink">Thank you. Your inquiry has been received.</p>
        <p className="mt-2 text-sm text-ink-soft">
          We&apos;ll pass your details to the owner or agent for {propertyTitle} and follow up
          with you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <FieldWrapper label="First Name" htmlFor="inquiry-first-name" required error={errors.firstName}>
          <TextInput
            id="inquiry-first-name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            error={Boolean(errors.firstName)}
            placeholder="First name"
          />
        </FieldWrapper>

        <FieldWrapper label="Last Name" htmlFor="inquiry-last-name" required error={errors.lastName}>
          <TextInput
            id="inquiry-last-name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            error={Boolean(errors.lastName)}
            placeholder="Last name"
          />
        </FieldWrapper>
      </div>

      <FieldWrapper label="Email" htmlFor="inquiry-email" required error={errors.email}>
        <TextInput
          id="inquiry-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={Boolean(errors.email)}
          placeholder="you@example.com"
        />
      </FieldWrapper>

      <FieldWrapper
        label="Phone / WhatsApp"
        htmlFor="inquiry-whatsapp"
        required
        error={errors.whatsapp}
      >
        <TextInput
          id="inquiry-whatsapp"
          value={form.whatsapp}
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          error={Boolean(errors.whatsapp)}
          placeholder="+66 8X XXX XXXX"
        />
      </FieldWrapper>

      <FieldWrapper label="Additional Requirements" htmlFor="inquiry-additional">
        <TextArea
          id="inquiry-additional"
          value={form.additionalRequirements}
          onChange={(e) => setForm({ ...form, additionalRequirements: e.target.value })}
          placeholder="Any questions about this property?"
        />
      </FieldWrapper>

      {submitError && (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-500">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {submitError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full bg-matcha-mist hover:opacity-90"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Sending...
          </>
        ) : (
          "ส่งคำสอบถาม"
        )}
      </Button>
    </form>
  );
}
