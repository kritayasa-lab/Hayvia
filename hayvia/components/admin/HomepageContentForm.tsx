"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import type { ContentActionState } from "@/app/admin/(dashboard)/content/actions";

export interface HomepageContentInitial {
  hero_title?: string | null;
  featured_heading?: string | null;
  featured_description?: string | null;
  popular_locations_heading?: string | null;
  cta_heading?: string | null;
  cta_body?: string | null;
}

export default function HomepageContentForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: ContentActionState | null, formData: FormData) => Promise<ContentActionState>;
  initial?: HomepageContentInitial;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <FieldWrapper label="Hero Title" htmlFor="hero_title">
        <TextInput id="hero_title" name="hero_title" defaultValue={initial?.hero_title ?? ""} />
      </FieldWrapper>

      <div className="border-t border-line-soft pt-5">
        <h3 className="font-display text-base text-ink">Featured Properties Section</h3>
        <div className="mt-3 space-y-4">
          <FieldWrapper label="Heading" htmlFor="featured_heading">
            <TextInput
              id="featured_heading"
              name="featured_heading"
              defaultValue={initial?.featured_heading ?? ""}
            />
          </FieldWrapper>
          <FieldWrapper label="Description" htmlFor="featured_description">
            <TextArea
              id="featured_description"
              name="featured_description"
              defaultValue={initial?.featured_description ?? ""}
            />
          </FieldWrapper>
        </div>
      </div>

      <div className="border-t border-line-soft pt-5">
        <h3 className="font-display text-base text-ink">Popular Locations Section</h3>
        <div className="mt-3">
          <FieldWrapper label="Heading" htmlFor="popular_locations_heading">
            <TextInput
              id="popular_locations_heading"
              name="popular_locations_heading"
              defaultValue={initial?.popular_locations_heading ?? ""}
            />
          </FieldWrapper>
        </div>
      </div>

      <div className="border-t border-line-soft pt-5">
        <h3 className="font-display text-base text-ink">Closing CTA</h3>
        <div className="mt-3 space-y-4">
          <FieldWrapper label="Heading" htmlFor="cta_heading">
            <TextInput id="cta_heading" name="cta_heading" defaultValue={initial?.cta_heading ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="Body" htmlFor="cta_body">
            <TextArea id="cta_body" name="cta_body" defaultValue={initial?.cta_body ?? ""} />
          </FieldWrapper>
        </div>
      </div>

      <SubmitButton pendingLabel="Saving...">{submitLabel}</SubmitButton>
    </form>
  );
}
