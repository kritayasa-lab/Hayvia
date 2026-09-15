import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OwnerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  line_id: string | null;
  whatsapp: string | null;
  default_commission_type: string | null;
  default_commission_value: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface AgentRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  agency_name: string | null;
  license_number: string | null;
  commission_split_percent: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export async function fetchOwners(): Promise<OwnerRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("owners").select("*").order("name", { ascending: true });
  return data ?? [];
}

export async function fetchAgents(): Promise<AgentRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("agents").select("*").order("name", { ascending: true });
  return data ?? [];
}
