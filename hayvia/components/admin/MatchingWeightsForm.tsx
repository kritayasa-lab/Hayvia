"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import { updateMatchingWeights } from "@/app/admin/(dashboard)/settings/actions";

interface Weights {
  id: string;
  budget_weight: number;
  location_weight: number;
  property_type_weight: number;
  bedrooms_weight: number;
  lifestyle_weight: number;
  amenities_weight: number;
  availability_weight: number;
}

const fields: { key: keyof Omit<Weights, "id">; label: string }[] = [
  { key: "budget_weight", label: "Budget" },
  { key: "location_weight", label: "Location" },
  { key: "property_type_weight", label: "Property Type" },
  { key: "bedrooms_weight", label: "Bedrooms" },
  { key: "lifestyle_weight", label: "Lifestyle" },
  { key: "amenities_weight", label: "Amenities" },
  { key: "availability_weight", label: "Availability" },
];

export default function MatchingWeightsForm({ weights }: { weights: Weights }) {
  const [state, formAction] = useFormState(updateMatchingWeights, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={weights.id} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {fields.map((field) => (
          <FieldWrapper key={field.key} label={field.label} htmlFor={field.key}>
            <TextInput
              id={field.key}
              name={field.key}
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={weights[field.key]}
            />
          </FieldWrapper>
        ))}
      </div>
      <p className="text-xs text-ink-faint">Weights must sum to exactly 100.</p>
      <SubmitButton pendingLabel="Saving...">Save Weights</SubmitButton>
    </form>
  );
}
