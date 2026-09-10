"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { submitLead } from "@/lib/leads";

interface FormState {
  name: string;
  email: string;
  message: string;
}

const initialState: FormState = { name: "", email: "", message: "" };

export default function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Please enter your name.";
    if (!form.email.trim() || !form.email.includes("@"))
      nextErrors.email = "Please enter a valid email.";
    if (!form.message.trim()) nextErrors.message = "Please enter a message.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStatus("submitting");
    await submitLead({
      source: "contact",
      submittedAt: new Date().toISOString(),
      ...form,
    });
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded border border-moss-100 bg-moss-50 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 text-moss-600" size={28} />
        <p className="font-display text-lg text-ink">Message sent</p>
        <p className="mt-2 text-sm text-ink-soft">
          Thanks for reaching out — we'll get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FieldWrapper label="Name" htmlFor="contact-name" required error={errors.name}>
        <TextInput
          id="contact-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={Boolean(errors.name)}
        />
      </FieldWrapper>
      <FieldWrapper label="Email" htmlFor="contact-email" required error={errors.email}>
        <TextInput
          id="contact-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={Boolean(errors.email)}
        />
      </FieldWrapper>
      <FieldWrapper label="Message" htmlFor="contact-message" required error={errors.message}>
        <TextArea
          id="contact-message"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          error={Boolean(errors.message)}
        />
      </FieldWrapper>
      <Button type="submit" size="lg" className="w-full" disabled={status === "submitting"}>
        {status === "submitting" ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Sending...
          </>
        ) : (
          "Send Message"
        )}
      </Button>
    </form>
  );
}
