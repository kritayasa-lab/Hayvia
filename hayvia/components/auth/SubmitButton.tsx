"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";

export default function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  /** Additional external condition (e.g. a resend cooldown) — ORed with the form's own pending state. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className={className} disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" size={18} />
          {pendingLabel || "Please wait..."}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
