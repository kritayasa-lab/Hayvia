"use server";

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AgentActionState {
  error?: string;
}

function field(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) || "").trim();
  return value || null;
}

function buildAgentRow(formData: FormData) {
  return {
    name: field(formData, "name") || "",
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    line_id: field(formData, "line_id"),
    whatsapp: field(formData, "whatsapp"),
    agency_name: field(formData, "agency_name"),
    license_number: field(formData, "license_number"),
    commission_split_percent: field(formData, "commission_split_percent")
      ? Number(field(formData, "commission_split_percent"))
      : null,
    notes: field(formData, "notes"),
  };
}

export async function createAgent(
  _prevState: AgentActionState | null,
  formData: FormData
): Promise<AgentActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const row = buildAgentRow(formData);
  if (!row.name) return { error: "Please enter an agent name." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("agents").insert({ ...row, created_by: admin.id });
  if (error) return { error: "Failed to create agent." };

  redirect("/admin/agents?created=1");
}

export async function updateAgent(
  id: string,
  _prevState: AgentActionState | null,
  formData: FormData
): Promise<AgentActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const row = buildAgentRow(formData);
  if (!row.name) return { error: "Please enter an agent name." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("agents").update(row).eq("id", id);
  if (error) return { error: "Failed to save changes." };

  redirect("/admin/agents?saved=1");
}

export async function toggleAgentStatus(id: string, nextStatus: "ACTIVE" | "INACTIVE") {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();
  await supabase.from("agents").update({ status: nextStatus }).eq("id", id);
  redirect("/admin/agents");
}
