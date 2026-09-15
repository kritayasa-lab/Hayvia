"use client";

import { useFormState } from "react-dom";
import { FieldWrapper, TextInput, TextArea } from "@/components/ui/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import FormMessage from "@/components/auth/FormMessage";
import type { AgentActionState } from "@/app/admin/(dashboard)/agents/actions";
import type { AgentRow } from "@/lib/admin/people";

export default function AgentForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: AgentActionState | null, formData: FormData) => Promise<AgentActionState>;
  initial?: Partial<AgentRow>;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldWrapper label="Name" htmlFor="agent-name" required>
          <TextInput id="agent-name" name="name" defaultValue={initial?.name} required />
        </FieldWrapper>
        <FieldWrapper label="Agency Name" htmlFor="agent-agency">
          <TextInput id="agent-agency" name="agency_name" defaultValue={initial?.agency_name ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="Phone" htmlFor="agent-phone">
          <TextInput id="agent-phone" name="phone" defaultValue={initial?.phone ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="Email" htmlFor="agent-email">
          <TextInput id="agent-email" name="email" type="email" defaultValue={initial?.email ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="License Number" htmlFor="agent-license">
          <TextInput id="agent-license" name="license_number" defaultValue={initial?.license_number ?? ""} />
        </FieldWrapper>
        <FieldWrapper label="Commission Split %" htmlFor="agent-commission">
          <TextInput
            id="agent-commission"
            name="commission_split_percent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={initial?.commission_split_percent ?? ""}
          />
        </FieldWrapper>
        <FieldWrapper label="Notes" htmlFor="agent-notes" className="sm:col-span-2">
          <TextArea id="agent-notes" name="notes" defaultValue={initial?.notes ?? ""} />
        </FieldWrapper>
      </div>
      <SubmitButton pendingLabel="Saving...">{submitLabel}</SubmitButton>
    </form>
  );
}
