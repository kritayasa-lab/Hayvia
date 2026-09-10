"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { submitLead } from "@/lib/leads";

interface FormState {
  name: string;
  email: string;
  whatsapp: string;
  moveInDate: string;
  message: string;
}

const initialState: FormState = {
  name: "",
  email: "",
  whatsapp: "",
  moveInDate: "",
  message: "",
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

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Please enter your name.";
    if (!form.email.trim() || !form.email.includes("@"))
      nextErrors.email = "Please enter a valid email.";
    if (!form.whatsapp.trim()) nextErrors.whatsapp = "Please enter a WhatsApp number.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setStatus("submitting");
    await submitLead({
      source: "property-inquiry",
      submittedAt: new Date().toISOString(),
      propertySlug,
      propertyTitle,
      ...form,
    });
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded border border-moss-100 bg-moss-50 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 text-moss-600" size={28} />
        <p className="font-display text-lg text-ink">Thanks — we've received your message</p>
        <p className="mt-2 text-sm text-ink-soft">
          We'll pass your details to the owner or agent for {propertyTitle} and follow up
          with you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FieldWrapper label="Name" htmlFor="inquiry-name" required error={errors.name}>
        <TextInput
          id="inquiry-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={Boolean(errors.name)}
          placeholder="Your full name"
        />
      </FieldWrapper>

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

      <FieldWrapper label="WhatsApp" htmlFor="inquiry-whatsapp" required error={errors.whatsapp}>
        <TextInput
          id="inquiry-whatsapp"
          value={form.whatsapp}
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          error={Boolean(errors.whatsapp)}
          placeholder="+60 1X XXX XXXX"
        />
      </FieldWrapper>

      <FieldWrapper label="Preferred move-in date" htmlFor="inquiry-movein">
        <TextInput
          id="inquiry-movein"
          type="date"
          value={form.moveInDate}
          onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
        />
      </FieldWrapper>

      <FieldWrapper label="Message" htmlFor="inquiry-message">
        <TextArea
          id="inquiry-message"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Any questions about this property?"
        />
      </FieldWrapper>

      <Button type="submit" size="lg" className="w-full" disabled={status === "submitting"}>
        {status === "submitting" ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Sending...
          </>
        ) : (
          "Send Inquiry"
        )}
      </Button>
    </form>
  );
}
