"use client";

import { useFormState } from "react-dom";
import { Sparkles } from "lucide-react";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import { importProperty } from "@/app/admin/(dashboard)/properties/import/actions";

/**
 * Single-stage import form: paste the full listing text (the AI's sole
 * input — see lib/ai/property-import.ts), optionally note the source URL
 * as provenance only, and extract. There is no URL fetch and no screenshot
 * upload anywhere in this flow — a Facebook link, any other link, or no
 * link at all are all handled identically, since the pasted text is what
 * actually gets read.
 */
export default function ImportPropertyForm() {
  const [state, formAction] = useFormState(importProperty, null);

  return (
    <form action={formAction} className="space-y-5">
      <FieldWrapper
        label="Property URL"
        htmlFor="url"
        hint="Optional — kept only as the source link, not read automatically."
      >
        <TextInput id="url" name="url" type="url" placeholder="https://..." />
      </FieldWrapper>

      <FieldWrapper
        label="Listing Details"
        htmlFor="listing_text"
        required
        hint="Paste the full property listing here. The AI will organize the price, property type, rooms, area, location, amenities and other details for you."
      >
        <TextArea
          id="listing_text"
          name="listing_text"
          required
          placeholder="Paste the complete listing text — e.g. copied from a Facebook post..."
          className="min-h-[240px]"
        />
      </FieldWrapper>

      <FormMessage state={state} />

      <SubmitButton pendingLabel="Extracting with AI...">
        <Sparkles size={16} /> Extract with AI
      </SubmitButton>
    </form>
  );
}
