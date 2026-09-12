"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";

export default function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className={className} disabled={pending}>
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
