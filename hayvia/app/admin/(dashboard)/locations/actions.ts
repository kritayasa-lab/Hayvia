"use server";

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

export interface LocationActionState {
  error?: string;
}

function field(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) || "").trim();
  return value || null;
}

function buildLocationRow(formData: FormData) {
  const province = field(formData, "province") || "";
  const city = field(formData, "city") || "";
  const district = field(formData, "district");
  const rawSlug = field(formData, "slug");
  const slug = slugify(rawSlug || [city, district].filter(Boolean).join("-") || province);

  return {
    country: field(formData, "country") || "Thailand",
    province,
    city,
    district,
    subdistrict: field(formData, "subdistrict"),
    slug,
    latitude: field(formData, "latitude") ? Number(field(formData, "latitude")) : null,
    longitude: field(formData, "longitude") ? Number(field(formData, "longitude")) : null,
    is_active: formData.get("is_active") === "on",
  };
}

export async function createLocation(
  _prevState: LocationActionState | null,
  formData: FormData
): Promise<LocationActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const row = buildLocationRow(formData);
  if (!row.province || !row.city) return { error: "Please enter a province and city." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("locations").insert(row);
  if (error) {
    if (error.code === "23505") return { error: "This location already exists." };
    return { error: "Failed to create location." };
  }

  redirect("/admin/locations?created=1");
}

export async function updateLocation(
  id: string,
  _prevState: LocationActionState | null,
  formData: FormData
): Promise<LocationActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const row = buildLocationRow(formData);
  if (!row.province || !row.city) return { error: "Please enter a province and city." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("locations").update(row).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "This location already exists." };
    return { error: "Failed to save changes." };
  }

  redirect("/admin/locations?saved=1");
}

export async function toggleLocationActive(id: string, nextActive: boolean) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  await supabase.from("locations").update({ is_active: nextActive }).eq("id", id);
  redirect("/admin/locations");
}
