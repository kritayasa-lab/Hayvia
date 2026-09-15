"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import type { LocationActionState } from "@/app/admin/(dashboard)/locations/actions";

export interface LocationInitial {
  country?: string;
  province?: string;
  city?: string;
  district?: string | null;
  subdistrict?: string | null;
  slug?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean;
}

export default function LocationForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: LocationActionState | null, formData: FormData) => Promise<LocationActionState>;
  initial?: LocationInitial;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldWrapper label="Country" htmlFor="loc-country" required>
          <TextInput id="loc-country" name="country" defaultValue={initial?.country ?? "Thailand"} required />
        </FieldWrapper>
        <FieldWrapper label="Province" htmlFor="loc-province" required>
          <TextInput id="loc-province" name="province" defaultValue={initial?.province} required />
        </FieldWrapper>
        <FieldWrapper label="City" htmlFor="loc-city" required>
          <TextInput id="loc-city" name="city" defaultValue={initial?.city} required />
        </FieldWrapper>
        <FieldWrapper label="District" htmlFor="loc-district">
          <TextInput id="loc-district" name="district" defaultValue={initial?.district ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="Subdistrict" htmlFor="loc-subdistrict">
          <TextInput id="loc-subdistrict" name="subdistrict" defaultValue={initial?.subdistrict ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="SEO Slug" htmlFor="loc-slug" hint="e.g. hat-yai. Leave blank to auto-generate.">
          <TextInput id="loc-slug" name="slug" defaultValue={initial?.slug ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="Latitude" htmlFor="loc-lat">
          <TextInput id="loc-lat" name="latitude" type="number" step="0.000001" defaultValue={initial?.latitude ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="Longitude" htmlFor="loc-lng">
          <TextInput id="loc-lng" name="longitude" type="number" step="0.000001" defaultValue={initial?.longitude ?? ""} />
        </FieldWrapper>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={initial?.is_active ?? true}
          className="h-4 w-4 rounded border-line text-moss-600 focus:ring-moss-500/30"
        />
        Active (visible in public location dropdowns)
      </label>
      <SubmitButton pendingLabel="Saving...">{submitLabel}</SubmitButton>
    </form>
  );
}
