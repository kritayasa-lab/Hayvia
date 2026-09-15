"use client";

import { useState } from "react";
import { AlertCircle, CalendarCheck2, Loader2 } from "lucide-react";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { submitLead } from "@/lib/leads";

// The public viewing flow is in-person only (see lib/leads.ts —
// PropertyViewingLead.viewingType is now the single literal value below).
// The Supabase `viewings.viewing_type` column still supports both
// IN_PERSON/VIDEO_CALL (see app/api/viewings/route.ts and
// supabase/migrations/20260912100013_pass2_viewing_type_and_min_size.sql) —
// nothing there needed to change, since a public submission has only ever
// been able to set that column, and it now always resolves to IN_PERSON.
const VIEWING_TYPE = "In-person Viewing" as const;

interface FormState {
  preferredDate: string;
  preferredTime: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  message: string;
}

const initialState: FormState = {
  preferredDate: "",
  preferredTime: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  message: "",
};

export default function ViewingForm({
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
    if (!form.preferredDate) nextErrors.preferredDate = "Please choose a preferred date.";
    if (!form.preferredTime) nextErrors.preferredTime = "Please choose a preferred time.";
    if (!form.firstName.trim()) nextErrors.firstName = "Please enter your first name.";
    if (!form.lastName.trim()) nextErrors.lastName = "Please enter your last name.";
    if (!form.phone.trim()) nextErrors.phone = "Please enter your phone or WhatsApp number.";
    if (!form.email.trim() || !form.email.includes("@"))
      nextErrors.email = "Please enter a valid email.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setStatus("submitting");
    setSubmitError(null);
    const result = await submitLead({
      source: "property-viewing",
      submittedAt: new Date().toISOString(),
      propertySlug,
      propertyTitle,
      viewingType: VIEWING_TYPE,
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
        <CalendarCheck2 className="mx-auto mb-3 text-moss-700" size={28} />
        <p className="font-display text-lg text-ink">Your viewing request has been received.</p>
        <p className="mt-2 text-sm text-ink-soft">
          Our team will contact you to confirm the appointment for {propertyTitle}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <FieldWrapper
          label="Preferred Date"
          htmlFor="viewing-date"
          required
          error={errors.preferredDate}
        >
          <TextInput
            id="viewing-date"
            type="date"
            value={form.preferredDate}
            onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
            error={Boolean(errors.preferredDate)}
          />
        </FieldWrapper>

        <FieldWrapper
          label="Preferred Time"
          htmlFor="viewing-time"
          required
          error={errors.preferredTime}
        >
          <TextInput
            id="viewing-time"
            type="time"
            value={form.preferredTime}
            onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
            error={Boolean(errors.preferredTime)}
          />
        </FieldWrapper>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldWrapper label="First Name" htmlFor="viewing-first-name" required error={errors.firstName}>
          <TextInput
            id="viewing-first-name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            error={Boolean(errors.firstName)}
            placeholder="First name"
          />
        </FieldWrapper>

        <FieldWrapper label="Last Name" htmlFor="viewing-last-name" required error={errors.lastName}>
          <TextInput
            id="viewing-last-name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            error={Boolean(errors.lastName)}
            placeholder="Last name"
          />
        </FieldWrapper>
      </div>

      <FieldWrapper label="Phone / WhatsApp" htmlFor="viewing-phone" required error={errors.phone}>
        <TextInput
          id="viewing-phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          error={Boolean(errors.phone)}
          placeholder="+66 8X XXX XXXX"
        />
      </FieldWrapper>

      <FieldWrapper label="Email" htmlFor="viewing-email" required error={errors.email}>
        <TextInput
          id="viewing-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={Boolean(errors.email)}
          placeholder="you@example.com"
        />
      </FieldWrapper>

      <FieldWrapper label="Additional Message / Comment" htmlFor="viewing-message">
        <TextArea
          id="viewing-message"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Anything else we should know before the viewing?"
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
          "Request Viewing"
        )}
      </Button>
    </form>
  );
}
