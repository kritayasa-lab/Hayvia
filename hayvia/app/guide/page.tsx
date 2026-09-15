import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import GuideCard from "@/components/guide/GuideCard";
import { getPublishedGuides } from "@/lib/news-source";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hat Yai Guide",
  description:
    "Practical, beginner-friendly guides to renting and living in Hat Yai — neighbourhoods, costs, and what to check before you sign a lease.",
};

export default async function GuidePage() {
  const { guides } = await getPublishedGuides();

  return (
    <Container className="py-10 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Hat Yai Guide</h1>
        <p className="mt-3 text-ink-soft">
          Practical, beginner-friendly articles to help you understand renting and
          living in Hat Yai before you commit to a property.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((article) => (
          <GuideCard key={article.slug} article={article} />
        ))}
      </div>
    </Container>
  );
}
