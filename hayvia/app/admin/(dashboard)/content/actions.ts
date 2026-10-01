"use server";

// -----------------------------------------------------------------------------
// Content CMS foundation (PR #45) — Homepage / About / Contact.
// -----------------------------------------------------------------------------
// Unlike News & Guides (a collection -- list/new/[id] pages), each of these
// is exactly one row per locale (see the migration's `unique (locale)`
// constraint), so there's no create-vs-update distinction from the admin's
// perspective: every save is an upsert keyed on locale. i18n isn't
// implemented yet, so every write here is hardcoded to locale "en" --
// the only locale that exists right now.
//
// Same auth/write pattern as every other admin action in this codebase:
// getAdminUser() (session-respecting, RLS-checked) confirms
// profiles.role = 'ADMIN' before createAdminClient() (service-role,
// RLS-bypassing) ever touches the database.
//
// These tables are not read by any public page yet -- saving here has no
// effect on the live site until a future PR wires app/page.tsx /
// app/about/page.tsx / app/contact/page.tsx to read from them.
// -----------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ContentActionState {
  error?: string;
}

function field(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) || "").trim();
  return value || null;
}

export async function upsertHomepageContent(
  _prevState: ContentActionState | null,
  formData: FormData
): Promise<ContentActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("homepage_content").upsert(
    {
      locale: "en",
      hero_title: field(formData, "hero_title"),
      featured_heading: field(formData, "featured_heading"),
      featured_description: field(formData, "featured_description"),
      popular_locations_heading: field(formData, "popular_locations_heading"),
      cta_heading: field(formData, "cta_heading"),
      cta_body: field(formData, "cta_body"),
    },
    { onConflict: "locale" }
  );

  if (error) return { error: error.message || "Failed to save changes." };

  redirect("/admin/content/homepage?saved=1");
}

export async function upsertAboutContent(
  _prevState: ContentActionState | null,
  formData: FormData
): Promise<ContentActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  // Fixed 3-entry array -- matches the About page's current "How we think
  // about this" section, which has never had a variable number of cards.
  const valueCards = [0, 1, 2].map((i) => ({
    title: field(formData, `value_title_${i}`) || "",
    description: field(formData, `value_description_${i}`) || "",
  }));

  const supabase = createAdminClient();
  const { error } = await supabase.from("about_content").upsert(
    {
      locale: "en",
      heading: field(formData, "heading"),
      body_1: field(formData, "body_1"),
      body_2: field(formData, "body_2"),
      value_cards: valueCards,
      cta_heading: field(formData, "cta_heading"),
      cta_body: field(formData, "cta_body"),
    },
    { onConflict: "locale" }
  );

  if (error) return { error: error.message || "Failed to save changes." };

  redirect("/admin/content/about?saved=1");
}

export async function upsertContactContent(
  _prevState: ContentActionState | null,
  formData: FormData
): Promise<ContentActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("contact_content").upsert(
    {
      locale: "en",
      heading: field(formData, "heading"),
      subheading: field(formData, "subheading"),
      brand: field(formData, "brand"),
      tagline: field(formData, "tagline"),
      descriptor: field(formData, "descriptor"),
      whatsapp_number: field(formData, "whatsapp_number"),
      whatsapp_link: field(formData, "whatsapp_link"),
      line_id: field(formData, "line_id"),
      line_link: field(formData, "line_link"),
      email: field(formData, "email"),
      email_link: field(formData, "email_link"),
      facebook_link: field(formData, "facebook_link"),
      instagram_link: field(formData, "instagram_link"),
      city: field(formData, "city"),
      site_url: field(formData, "site_url"),
    },
    { onConflict: "locale" }
  );

  if (error) return { error: error.message || "Failed to save changes." };

  redirect("/admin/content/contact?saved=1");
}
