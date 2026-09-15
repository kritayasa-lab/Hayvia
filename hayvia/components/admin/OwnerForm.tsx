"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput, TextArea, Select } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import type { OwnerActionState } from "@/app/admin/(dashboard)/owners/actions";
import type { OwnerRow } from "@/lib/admin/people";

export default function OwnerForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: OwnerActionState | null, formData: FormData) => Promise<OwnerActionState>;
  initial?: Partial<OwnerRow>;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldWrapper label="Name" htmlFor="owner-name" required>
          <TextInput id="owner-name" name="name" defaultValue={initial?.name} required />
        </FieldWrapper>
        <FieldWrapper label="Phone" htmlFor="owner-phone">
          <TextInput id="owner-phone" name="phone" defaultValue={initial?.phone ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="Email" htmlFor="owner-email">
          <TextInput id="owner-email" name="email" type="email" defaultValue={initial?.email ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="WhatsApp" htmlFor="owner-whatsapp">
          <TextInput id="owner-whatsapp" name="whatsapp" defaultValue={initial?.whatsapp ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="LINE ID" htmlFor="owner-line">
          <TextInput id="owner-line" name="line_id" defaultValue={initial?.line_id ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="Default Commission Type" htmlFor="owner-commission-type">
          <Select
            id="owner-commission-type"
            name="default_commission_type"
            defaultValue={initial?.default_commission_type ?? ""}
          >
            <option value="">—</option>
            <option value="PERCENT">Percent</option>
            <option value="FIXED">Fixed</option>
          </Select>
        </FieldWrapper>
        <FieldWrapper label="Default Commission Value" htmlFor="owner-commission-value">
          <TextInput
            id="owner-commission-value"
            name="default_commission_value"
            type="number"
            min={0}
            step="0.01"
            defaultValue={initial?.default_commission_value ?? ""}
          />
        </FieldWrapper>
        <FieldWrapper label="Notes" htmlFor="owner-notes" className="sm:col-span-2">
          <TextArea id="owner-notes" name="notes" defaultValue={initial?.notes ?? ""} />
        </FieldWrapper>
      </div>
      <SubmitButton pendingLabel="Saving...">{submitLabel}</SubmitButton>
    </form>
  );
}
