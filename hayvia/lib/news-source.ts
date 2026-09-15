// -----------------------------------------------------------------------------
// News & Guides data source.
// -----------------------------------------------------------------------------
// PRIMARY source: Supabase `news_articles` (admin-managed, see
// app/admin/(dashboard)/news/). Read through the anon-key server client
// (lib/supabase/server.ts), which respects RLS — the "Public can view
// published news articles" policy (migration 14) is what makes this
// readable at all, and a DRAFT row is simply invisible here, never a
// privacy concern to filter in application code.
//
// FALLBACK: if Supabase has zero published articles (nothing migrated yet,
// or the admin hasn't published anything), or the query fails for any
// reason, we fall back to the hardcoded demo articles in data/guides.ts —
// the exact same fallback shape used by lib/properties-source.ts for Google
// Sheets, so /guide never shows a broken or empty page.
// -----------------------------------------------------------------------------

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { guides as demoGuides, type GuideArticle } from "@/data/guides";

function estimateReadingTime(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

function toParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function mapRowToGuideArticle(row: {
  slug: string;
  title: string;
  category: string | null;
  content: string;
  published_at: string | null;
  cover_image_url: string | null;
}): GuideArticle {
  const paragraphs = toParagraphs(row.content);
  return {
    slug: row.slug,
    title: row.title,
    excerpt: paragraphs[0]?.slice(0, 200) || "",
    category: row.category || "Guide",
    readingTime: estimateReadingTime(row.content),
    date: row.published_at || new Date().toISOString(),
    image: row.cover_image_url || "https://picsum.photos/seed/subphiphat-news-fallback/1200/700",
    content: paragraphs.length > 0 ? paragraphs : [row.content],
  };
}

export const getPublishedGuides = cache(async (): Promise<{
  guides: GuideArticle[];
  source: "supabase" | "fallback";
}> => {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("news_articles")
      .select("slug, title, category, content, published_at, cover_image_url")
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("No published articles in Supabase yet.");

    return { guides: data.map(mapRowToGuideArticle), source: "supabase" };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Subphiphat] Falling back to demo guide articles:", error);
    return { guides: demoGuides, source: "fallback" };
  }
});

export function findGuideBySlug(list: GuideArticle[], slug: string): GuideArticle | undefined {
  return list.find((g) => g.slug === slug);
}
