import AdminCard from "@/components/admin/AdminCard";
import NewsForm from "@/components/admin/NewsForm";
import { createNewsArticle } from "@/app/admin/(dashboard)/news/actions";

export const dynamic = "force-dynamic";

export default function NewNewsArticlePage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">New Article</h1>
      <div className="mt-6 max-w-2xl">
        <AdminCard>
          <NewsForm action={createNewsArticle} submitLabel="Create Article" />
        </AdminCard>
      </div>
    </div>
  );
}
