import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import HomepageContentForm from "@/components/admin/HomepageContentForm";
import { upsertHomepageContent } from "@/app/admin/(dashboard)/content/actions";

export const dynamic = "force-dynamic";

export default async function HomepageContentPage() {
  const supabase = createAdminClient();
  const { data: content } = await supabase
    .from("homepage_content")
    .select("*")
    .eq("locale", "en")
    .maybeSingle();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Homepage Content</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Not yet shown on the live site — the homepage still reads its copy from code.
      </p>
      <div className="mt-6 max-w-2xl">
        <AdminCard>
          <HomepageContentForm
            action={upsertHomepageContent}
            initial={{
              hero_title: content?.hero_title,
              featured_heading: content?.featured_heading,
              featured_description: content?.featured_description,
              popular_locations_heading: content?.popular_locations_heading,
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
