"use server";

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OwnerActionState {
  error?: string;
}

function field(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) || "").trim();
  return value || null;
}

function buildOwnerRow(formData: FormData) {
  return {
    name: field(formData, "name") || "",
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    line_id: field(formData, "line_id"),
    whatsapp: field(formData, "whatsapp"),
    default_commission_type: field(formData, "default_commission_type"),
    default_commission_value: field(formData, "default_commission_value")
      ? Number(field(formData, "default_commission_value"))
      : null,
    notes: field(formData, "notes"),
  };
}

export async function createOwner(
  _prevState: OwnerActionState | null,
  formData: FormData
): Promise<OwnerActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const row = buildOwnerRow(formData);
  if (!row.name) return { error: "Please enter an owner name." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("owners").insert({ ...row, created_by: admin.id });
  if (error) return { error: "Failed to create owner." };

  redirect("/admin/owners?created=1");
}

export async function updateOwner(
  id: string,
  _prevState: OwnerActionState | null,
  formData: FormData
): Promise<OwnerActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const row = buildOwnerRow(formData);
  if (!row.name) return { error: "Please enter an owner name." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("owners").update(row).eq("id", id);
  if (error) return { error: "Failed to save changes." };

  redirect("/admin/owners?saved=1");
}

export async function toggleOwnerStatus(id: string, nextStatus: "ACTIVE" | "INACTIVE") {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  await supabase.from("owners").update({ status: nextStatus }).eq("id", id);
  redirect("/admin/owners");
}
