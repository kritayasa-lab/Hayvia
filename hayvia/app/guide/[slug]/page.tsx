import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { getPublishedGuides, findGuideBySlug } from "@/lib/news-source";
import { formatDate } from "@/lib/utils";

// Article data can come from Supabase (admin-managed) or the static
// fallback (see lib/news-source.ts) — either way it can change without a
// deploy, so this page is rendered dynamically per request rather than
// statically pre-built, the same reasoning as /properties/[slug].
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const { guides } = await getPublishedGuides();
  const article = findGuideBySlug(guides, params.slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [article.image],
    },
  };
}

export default async function GuideArticlePage({ params }: { params: { slug: string } }) {
  const { guides } = await getPublishedGuides();
  const article = findGuideBySlug(guides, params.slug);
  if (!article) notFound();

  return (
    <article>
      <Container className="max-w-3xl py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-faint">
          <Link href="/guide" className="hover:text-ink">
            Hat Yai Guide
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">{article.category}</span>
        </nav>

        <p className="text-sm font-medium text-moss-700">{article.category}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
          {article.title}
        </h1>
        <div className="mt-4 flex items-center gap-2 text-sm text-ink-faint">
          <span>{formatDate(article.date)}</span>
          <span aria-hidden>·</span>
          <span>{article.readingTime}</span>
        </div>

        <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded">
          {/* Plain <img>, not next/image — see GuideCard.tsx for why. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.image}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <div className="mt-8 space-y-5">
          {article.content.map((paragraph, index) => (
            <p key={index} className="leading-relaxed text-ink-soft">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-14 rounded border border-line bg-surface p-8 text-center">
          <p className="font-display text-xl text-ink">Ready to start looking?</p>
          <p className="mt-2 text-sm text-ink-soft">
            Browse current listings or tell us what you need and we&apos;ll help you find it.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Button href="/properties" variant="secondary">
              Browse Properties
            </Button>
            <Button href="/get-matched">Get Matched</Button>
          </div>
        </div>
      </Container>
    </article>
  );
}
