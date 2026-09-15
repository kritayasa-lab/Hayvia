"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import InquiryForm from "@/components/property/InquiryForm";

export default function InquiryPanel({
  propertySlug,
  propertyTitle,
}: {
  propertySlug: string;
  propertyTitle: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-seashell bg-white p-6">
      {!open ? (
        <>
          <p className="font-display text-lg text-ink">Interested in this property?</p>
          <p className="mt-1.5 text-sm text-ink-soft">
            Send a quick message and we&apos;ll connect you with the property owner or agent.
          </p>
          <Button
            size="lg"
            className="mt-4 w-full bg-matcha-mist hover:opacity-90"
            onClick={() => setOpen(true)}
          >
            <MessageCircle size={18} />
            I&apos;m Interested
          </Button>
        </>
      ) : (
        <InquiryForm propertySlug={propertySlug} propertyTitle={propertyTitle} />
      )}
    </div>
  );
}
