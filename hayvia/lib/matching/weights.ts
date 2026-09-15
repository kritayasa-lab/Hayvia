import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultMatchWeights, type MatchWeights } from "@/lib/matching/types";

interface MatchingWeightsRow {
  budget_weight: number;
  location_weight: number;
  property_type_weight: number;
  bedrooms_weight: number;
  lifestyle_weight: number;
  amenities_weight: number;
  availability_weight: number;
}

/**
 * Reads the active row from matching_weights (service-role — this table has
 * RLS enabled with no anon/authenticated policy, same as every other
 * matching/CRM table until Phase 11). Falls back to the same values the
 * table was originally seeded with if the read fails for any reason
 * (migrations not applied yet, network issue, etc.) — this is the
 * documented default from matching_weights' own seed row, not an invented
 * number, so scoring stays honest either way.
 */
export async function getActiveMatchWeights(): Promise<{
  weights: MatchWeights;
  source: "database" | "default-fallback";
}> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("matching_weights")
      .select(
        "budget_weight, location_weight, property_type_weight, bedrooms_weight, lifestyle_weight, amenities_weight, availability_weight"
      )
      .eq("is_active", true)
      .maybeSingle<MatchingWeightsRow>();

    if (error || !data) throw error ?? new Error("No active matching_weights row found.");

    return {
      weights: {
        budget: Number(data.budget_weight),
        location: Number(data.location_weight),
        propertyType: Number(data.property_type_weight),
        bedrooms: Number(data.bedrooms_weight),
        lifestyle: Number(data.lifestyle_weight),
        amenities: Number(data.amenities_weight),
        availability: Number(data.availability_weight),
      },
      source: "database",
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[Subphiphat] Could not read matching_weights — using the schema's documented default weighting:",
      error
    );
    return { weights: defaultMatchWeights, source: "default-fallback" };
  }
}
