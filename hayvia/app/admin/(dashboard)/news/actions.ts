"use server";

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

export interface NewsActionState {
  error?: string;
}

function field(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) || "").trim();
  return value || null;
}

function buildNewsRow(formData: FormData) {
  const status = field(formData, "status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const publishedAt = field(formData, "published_at");

  return {
    title: field(formData, "title") || "",
    cover_image_url: field(formData, "cover_image_url"),
    category: field(formData, "category"),
    content: String(formData.get("content") || ""),
    status,
    // A PUBLISHED article always has a real published_at — defaults to now()
    // if the admin didn't set one explicitly, so the public list/sort never
    // has to deal with a published article with a null date.
    published_at: status === "PUBLISHED" ? publishedAt || new Date().toISOString() : publishedAt,
    seo_title: field(formData, "seo_title"),
    seo_description: field(formData, "seo_description"),
  };
}

export async function createNewsArticle(
  _prevState: NewsActionState | null,
  formData: FormData
): Promise<NewsActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const row = buildNewsRow(formData);
  if (!row.title) return { error: "Please enter a title." };

  const rawSlug = field(formData, "slug");
  const slug = slugify(rawSlug || row.title);
  if (!slug) return { error: "Could not generate a URL slug from that title." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("news_articles")
    .insert({ ...row, slug, author_id: admin.id })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { error: "An article with that URL slug already exists." };
    return { error: "Failed to create article." };
  }

  redirect(`/admin/news/${data.id}?created=1`);
}

export async function updateNewsArticle(
  id: string,
  _prevState: NewsActionState | null,
  formData: FormData
): Promise<NewsActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const row = buildNewsRow(formData);
  if (!row.title) return { error: "Please enter a title." };

  const rawSlug = field(formData, "slug");
  const slug = slugify(rawSlug || row.title);

  const supabase = createAdminClient();
  const { error } = await supabase.from("news_articles").update({ ...row, slug }).eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "An article with that URL slug already exists." };
    return { error: "Failed to save changes." };
  }

  redirect(`/admin/news/${id}?saved=1`);
}
