"use server";

import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SettingsActionState {
  error?: string;
  success?: string;
}

const WEIGHT_FIELDS = [
  "budget_weight",
  "location_weight",
  "property_type_weight",
  "bedrooms_weight",
  "lifestyle_weight",
  "amenities_weight",
  "availability_weight",
] as const;

export async function updateMatchingWeights(
  _prevState: SettingsActionState | null,
  formData: FormData
): Promise<SettingsActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Not authorized." };

  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing weights row id." };

  const values: Record<string, number> = {};
  for (const field of WEIGHT_FIELDS) {
    const raw = Number(formData.get(field));
    if (!Number.isFinite(raw) || raw < 0) {
      return { error: "Every weight must be a non-negative number." };
    }
    values[field] = raw;
  }

  const sum = WEIGHT_FIELDS.reduce((total, field) => total + values[field], 0);
  // Matches the DB's own CHECK constraint (chk_matching_weights_sum_100) —
  // validated here too so the admin gets a clear message instead of a raw
  // Postgres constraint-violation error.
  if (Math.round(sum * 100) / 100 !== 100) {
    return { error: `Weights must sum to exactly 100 (currently ${sum}).` };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("matching_weights")
    .update({ ...values, updated_by: admin.id })
    .eq("id", id);

  if (error) return { error: "Failed to save weights." };

  return { success: "Matching weights updated." };
}
