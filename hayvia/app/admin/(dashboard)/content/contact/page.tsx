import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import ContactContentForm from "@/components/admin/ContactContentForm";
import { upsertContactContent } from "@/app/admin/(dashboard)/content/actions";

export const dynamic = "force-dynamic";

export default async function ContactContentPage() {
  const supabase = createAdminClient();
  const { data: content } = await supabase
    .from("contact_content")
    .select("*")
    .eq("locale", "en")
    .maybeSingle();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Contact Page Content</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Not yet shown on the live site — the Contact page and config/contact.ts still provide these values.
      </p>
      <div className="mt-6 max-w-2xl">
        <AdminCard>
          <ContactContentForm
            action={upsertContactContent}
            initial={{
              heading: content?.heading,
              subheading: content?.subheading,
              brand: content?.brand,
              tagline: content?.tagline,
              descriptor: content?.descriptor,
              whatsapp_number: content?.whatsapp_number,
              whatsapp_link: content?.whatsapp_link,
              line_id: content?.line_id,
              line_link: content?.line_link,
              email: content?.email,
              email_link: content?.email_link,
              facebook_link: content?.facebook_link,
              instagram_link: content?.instagram_link,
              city: content?.city,
              site_url: content?.site_url,
            }}
            submitLabel="Save Changes"
          />
        </AdminCard>
      </div>
    </div>
  );
}
