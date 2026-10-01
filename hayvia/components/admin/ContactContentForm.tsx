"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import type { ContentActionState } from "@/app/admin/(dashboard)/content/actions";

export interface ContactContentInitial {
  heading?: string | null;
  subheading?: string | null;
  brand?: string | null;
  tagline?: string | null;
  descriptor?: string | null;
  whatsapp_number?: string | null;
  whatsapp_link?: string | null;
  line_id?: string | null;
  line_link?: string | null;
  email?: string | null;
  email_link?: string | null;
  facebook_link?: string | null;
  instagram_link?: string | null;
  city?: string | null;
  site_url?: string | null;
}

export default function ContactContentForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: ContentActionState | null, formData: FormData) => Promise<ContentActionState>;
  initial?: ContactContentInitial;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <div>
        <h3 className="font-display text-base text-ink">Page Copy</h3>
        <div className="mt-3 space-y-4">
          <FieldWrapper label="Heading" htmlFor="heading">
            <TextInput id="heading" name="heading" defaultValue={initial?.heading ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="Subheading" htmlFor="subheading">
            <TextArea id="subheading" name="subheading" defaultValue={initial?.subheading ?? ""} />
          </FieldWrapper>
        </div>
      </div>

      <div className="border-t border-line-soft pt-5">
        <h3 className="font-display text-base text-ink">Brand</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="Brand Name" htmlFor="brand">
            <TextInput id="brand" name="brand" defaultValue={initial?.brand ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="Tagline" htmlFor="tagline">
            <TextInput id="tagline" name="tagline" defaultValue={initial?.tagline ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="Descriptor" htmlFor="descriptor" className="sm:col-span-2">
            <TextInput id="descriptor" name="descriptor" defaultValue={initial?.descriptor ?? ""} />
          </FieldWrapper>
        </div>
      </div>

      <div className="border-t border-line-soft pt-5">
        <h3 className="font-display text-base text-ink">Contact Methods</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="WhatsApp Number" htmlFor="whatsapp_number">
            <TextInput id="whatsapp_number" name="whatsapp_number" defaultValue={initial?.whatsapp_number ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="WhatsApp Link" htmlFor="whatsapp_link">
            <TextInput id="whatsapp_link" name="whatsapp_link" type="url" defaultValue={initial?.whatsapp_link ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="LINE ID" htmlFor="line_id">
            <TextInput id="line_id" name="line_id" defaultValue={initial?.line_id ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="LINE Link" htmlFor="line_link">
            <TextInput id="line_link" name="line_link" type="url" defaultValue={initial?.line_link ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="Email" htmlFor="email">
            <TextInput id="email" name="email" type="email" defaultValue={initial?.email ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="Email Link" htmlFor="email_link">
            <TextInput id="email_link" name="email_link" defaultValue={initial?.email_link ?? ""} placeholder="mailto:..." />
          </FieldWrapper>
          <FieldWrapper label="Facebook Link" htmlFor="facebook_link">
            <TextInput id="facebook_link" name="facebook_link" type="url" defaultValue={initial?.facebook_link ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="Instagram Link" htmlFor="instagram_link">
            <TextInput id="instagram_link" name="instagram_link" type="url" defaultValue={initial?.instagram_link ?? ""} />
          </FieldWrapper>
        </div>
      </div>

      <div className="border-t border-line-soft pt-5">
        <h3 className="font-display text-base text-ink">Location &amp; Site</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label="City" htmlFor="city">
            <TextInput id="city" name="city" defaultValue={initial?.city ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="Site URL" htmlFor="site_url">
            <TextInput id="site_url" name="site_url" type="url" defaultValue={initial?.site_url ?? ""} />
          </FieldWrapper>
        </div>
      </div>

      <SubmitButton pendingLabel="Saving...">{submitLabel}</SubmitButton>
    </form>
  );
}
