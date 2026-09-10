import Image from "next/image";
import Link from "next/link";
import type { GuideArticle } from "@/data/guides";
import { formatDate } from "@/lib/utils";

export default function GuideCard({ article }: { article: GuideArticle }) {
  return (
    <Link
      href={`/guide/${article.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded border border-line bg-surface shadow-card transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-line-soft">
        <Image
          src={article.image}
          alt={article.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium text-moss-700">{article.category}</p>
        <h3 className="mt-2 font-display text-lg leading-snug text-ink">{article.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{article.excerpt}</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-faint">
          <span>{formatDate(article.date)}</span>
          <span aria-hidden>·</span>
          <span>{article.readingTime}</span>
        </div>
      </div>
    </Link>
  );
}
