import Link from "next/link";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function fetchNewsArticles() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("news_articles")
    .select("id, title, slug, category, status, published_at, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function AdminNewsPage() {
  const articles = await fetchNewsArticles();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">News &amp; Guides</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Published articles appear on the public /guide pages. {articles.length} articles.
          </p>
        </div>
        <Link
          href="/admin/news/new"
          className="flex items-center gap-1.5 rounded bg-moss-600 px-4 py-2 text-sm font-medium text-white hover:bg-moss-700"
        >
          <Plus size={15} /> New Article
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-line-soft/60 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {articles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">
                  No articles yet. The public /guide pages are showing the built-in demo articles as a fallback.
                </td>
              </tr>
            ) : (
              articles.map((article) => (
                <tr key={article.id} className="hover:bg-line-soft/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/news/${article.id}`}
                      className="font-medium text-ink hover:text-moss-700 hover:underline"
                    >
                      {article.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{article.category || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={article.status === "PUBLISHED" ? "moss" : "neutral"}>{article.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {article.published_at ? formatDate(article.published_at) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
