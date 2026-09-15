import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import NewsForm from "@/components/admin/NewsForm";
import { updateNewsArticle } from "@/app/admin/(dashboard)/news/actions";

export const dynamic = "force-dynamic";

export default async function EditNewsArticlePage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data: article } = await supabase.from("news_articles").select("*").eq("id", params.id).single();

  if (!article) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">{article.title}</h1>
      <div className="mt-6 max-w-2xl">
        <AdminCard>
          <NewsForm
            action={updateNewsArticle.bind(null, article.id)}
            initial={{
              title: article.title,
              slug: article.slug,
              cover_image_url: article.cover_image_url,
              category: article.category,
              content: article.content,
              status: article.status,
              published_at: article.published_at,
              seo_title: article.seo_title,
              seo_description: article.seo_description,
            }}
            submitLabel="Save Changes"
          />
        </AdminCard>
      </div>
    </div>
  );
}
