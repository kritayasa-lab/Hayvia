"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import type { ContentActionState } from "@/app/admin/(dashboard)/content/actions";

export interface AboutValueCard {
  title: string;
  description: string;
}

export interface AboutContentInitial {
  heading?: string | null;
  body_1?: string | null;
  body_2?: string | null;
  value_cards?: AboutValueCard[] | null;
  cta_heading?: string | null;
  cta_body?: string | null;
}

export default function AboutContentForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: ContentActionState | null, formData: FormData) => Promise<ContentActionState>;
  initial?: AboutContentInitial;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, null);
  // Always exactly 3 cards -- matches the current About page's "How we
  // think about this" section, which has never had a variable number of
  // these. Pad with empty cards if fewer than 3 are stored, never more.
  const cards = [0, 1, 2].map((i) => initial?.value_cards?.[i] ?? { title: "", description: "" });

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <FieldWrapper label="Heading" htmlFor="heading">
        <TextInput id="heading" name="heading" defaultValue={initial?.heading ?? ""} />
      </FieldWrapper>

      <FieldWrapper label="Body Paragraph 1" htmlFor="body_1">
        <TextArea id="body_1" name="body_1" defaultValue={initial?.body_1 ?? ""} className="min-h-[100px]" />
      </FieldWrapper>

      <FieldWrapper label="Body Paragraph 2" htmlFor="body_2">
        <TextArea id="body_2" name="body_2" defaultValue={initial?.body_2 ?? ""} className="min-h-[100px]" />
      </FieldWrapper>

      <div className="border-t border-line-soft pt-5">
        <h3 className="font-display text-base text-ink">How We Think About This (3 cards)</h3>
        <div className="mt-3 space-y-5">
          {cards.map((card, i) => (
            <div key={i} className="rounded border border-line-soft p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Card {i + 1}</p>
              <div className="mt-2 space-y-3">
                <FieldWrapper label="Title" htmlFor={`value_title_${i}`}>
                  <TextInput id={`value_title_${i}`} name={`value_title_${i}`} defaultValue={card.title} />
                </FieldWrapper>
                <FieldWrapper label="Description" htmlFor={`value_description_${i}`}>
                  <TextArea
                    id={`value_description_${i}`}
                    name={`value_description_${i}`}
                    defaultValue={card.description}
                  />
                </FieldWrapper>
              </div>
            </div>
          ))}
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
