import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import MatchingWeightsForm from "@/components/admin/MatchingWeightsForm";

export const dynamic = "force-dynamic";

async function fetchActiveWeights() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("matching_weights").select("*").eq("is_active", true).single();
  return data;
}

export default async function AdminSettingsPage() {
  const weights = await fetchActiveWeights();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-faint">Configuration for the Get Matched scoring engine.</p>

      <div className="mt-6 max-w-2xl">
        <AdminCard
          title="Matching Engine Weights"
          description="Changes apply to every new Get Matched run immediately — no deploy needed."
        >
          {weights ? (
            <MatchingWeightsForm weights={weights} />
          ) : (
            <p className="text-sm text-ink-faint">No active weights row found.</p>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
