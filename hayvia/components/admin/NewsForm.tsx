"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput, TextArea, Select } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import type { NewsActionState } from "@/app/admin/(dashboard)/news/actions";

export interface NewsInitial {
  title?: string;
  slug?: string;
  cover_image_url?: string | null;
  category?: string | null;
  content?: string;
  status?: string;
  published_at?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
}

export default function NewsForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: NewsActionState | null, formData: FormData) => Promise<NewsActionState>;
  initial?: NewsInitial;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <FieldWrapper label="Title" htmlFor="news-title" required>
        <TextInput id="news-title" name="title" defaultValue={initial?.title} required />
      </FieldWrapper>

      <FieldWrapper label="URL Slug" htmlFor="news-slug" hint="Leave blank to auto-generate from the title.">
        <TextInput id="news-slug" name="slug" defaultValue={initial?.slug ?? ""} />
      </FieldWrapper>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldWrapper label="Category" htmlFor="news-category">
          <TextInput id="news-category" name="category" defaultValue={initial?.category ?? ""} placeholder="e.g. Neighbourhoods" />
        </FieldWrapper>
        <FieldWrapper label="Status" htmlFor="news-status">
          <Select id="news-status" name="status" defaultValue={initial?.status ?? "DRAFT"}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </Select>
        </FieldWrapper>
      </div>

      <FieldWrapper label="Cover Image URL" htmlFor="news-cover">
        <TextInput
          id="news-cover"
          name="cover_image_url"
          type="url"
          defaultValue={initial?.cover_image_url ?? ""}
          placeholder="https://..."
        />
      </FieldWrapper>

      <FieldWrapper
        label="Content"
        htmlFor="news-content"
        hint="Separate paragraphs with a blank line."
      >
        <TextArea
          id="news-content"
          name="content"
          defaultValue={initial?.content ?? ""}
          className="min-h-[280px]"
        />
      </FieldWrapper>

      <div className="border-t border-line-soft pt-5">
        <h3 className="font-display text-base text-ink">SEO</h3>
        <div className="mt-3 grid grid-cols-1 gap-4">
          <FieldWrapper label="SEO Title" htmlFor="news-seo-title" hint="Defaults to the article title if left blank.">
            <TextInput id="news-seo-title" name="seo_title" defaultValue={initial?.seo_title ?? ""} />
          </FieldWrapper>
          <FieldWrapper label="SEO Description" htmlFor="news-seo-description">
            <TextArea id="news-seo-description" name="seo_description" defaultValue={initial?.seo_description ?? ""} />
          </FieldWrapper>
        </div>
      </div>

      <SubmitButton pendingLabel="Saving...">{submitLabel}</SubmitButton>
    </form>
  );
}
