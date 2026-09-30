"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import {
  importPropertyFromUrl,
  importPropertyFromManualContent,
} from "@/app/admin/(dashboard)/properties/import/actions";

/**
 * Two-stage import UI. Stage 1 is always visible (paste a URL). If the
 * server-side fetch fails for any reason — blocked, login wall, JS-rendered
 * page, network error, or the AI step itself failing/unconfigured — the
 * action returns `fallback: true` and stage 2 appears: paste the listing
 * text directly and/or upload a screenshot, or just go create the property
 * by hand. The admin is never left at a dead end.
 */
export default function ImportPropertyForm() {
  const [urlState, urlFormAction] = useFormState(importPropertyFromUrl, null);
  const [manualState, manualFormAction] = useFormState(importPropertyFromManualContent, null);
  const [typedUrl, setTypedUrl] = useState("");

  const showFallback = Boolean(urlState?.fallback || manualState?.fallback);

  return (
    <div className="space-y-8">
      <form action={urlFormAction} className="space-y-4">
        <FieldWrapper
          label="Property URL"
          htmlFor="url"
          required
          hint="A public listing page — the site's own listing, a classifieds post, etc."
        >
          <TextInput
            id="url"
            name="url"
            type="url"
            required
            placeholder="https://example.com/listing/123"
            value={typedUrl}
            onChange={(e) => setTypedUrl(e.target.value)}
          />
        </FieldWrapper>
        <FormMessage state={urlState} />
        <SubmitButton pendingLabel="Fetching & extracting...">Fetch &amp; Extract</SubmitButton>
      </form>

      {showFallback && (
        <div className="space-y-4 rounded-lg border border-dashed border-line-soft bg-seashell/30 p-5">
          <div>
            <h3 className="font-display text-base text-ink">Couldn&apos;t read that source</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Some sources (Facebook and other social links especially) are login-walled or block
              automatic reading. Try one of these instead — nothing here is a dead end.
            </p>
          </div>

          <form action={manualFormAction} className="space-y-4">
            <input type="hidden" name="source_url" value={typedUrl} />
            <FieldWrapper
              label="Paste the listing text"
              htmlFor="pasted_text"
              hint="Copy the title, price, description, etc. straight from the source page or message."
            >
              <TextArea
                id="pasted_text"
                name="pasted_text"
                placeholder="Paste the listing text here..."
              />
            </FieldWrapper>
            <FieldWrapper
              label="Or upload a screenshot"
              htmlFor="screenshot"
              hint="Used only to extract data — it is not saved as a property photo."
            >
              <input
                id="screenshot"
                name="screenshot"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded file:border-0 file:bg-moss-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-moss-700"
              />
            </FieldWrapper>
            <FormMessage state={manualState} />
            <SubmitButton pendingLabel="Extracting...">Extract from pasted content</SubmitButton>
          </form>

          <div className="border-t border-line-soft pt-4">
            <Link
              href="/admin/properties/new"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-moss-700 hover:underline"
            >
              Continue to manual property creation <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
