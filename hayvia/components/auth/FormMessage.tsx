import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ActionState } from "@/lib/auth/actions";

export default function FormMessage({ state }: { state: ActionState | null }) {
  if (!state?.error && !state?.success) return null;

  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
        {state.error}
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2 rounded border border-moss-100 bg-moss-50 px-3.5 py-2.5 text-sm text-moss-700">
      <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
      {state.success}
    </p>
  );
}
