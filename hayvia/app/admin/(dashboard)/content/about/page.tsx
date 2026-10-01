import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import AboutContentForm from "@/components/admin/AboutContentForm";
import { upsertAboutContent } from "@/app/admin/(dashboard)/content/actions";

export const dynamic = "force-dynamic";

export default async function AboutContentPage() {
  const supabase = createAdminClient();
  const { data: content } = await supabase
    .from("about_content")
    .select("*")
    .eq("locale", "en")
    .maybeSingle();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">About Page Content</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Not yet shown on the live site — the About page still reads its copy from code.
      </p>
      <div className="mt-6 max-w-2xl">
        <AdminCard>
          <AboutContentForm
            action={upsertAboutContent}
            initial={{
              heading: content?.heading,
              body_1: content?.body_1,
              body_2: content?.body_2,
              value_cards: content?.value_cards,
              cta_heading: content?.cta_heading,
              cta_body: content?.cta_body,
            }}
            submitLabel="Save Changes"
          />
        </AdminCard>
      </div>
    </div>
  );
}
