"use client";

import { useState } from "react";
import { MessageCircle, CalendarClock } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InquiryForm from "@/components/property/InquiryForm";
import ViewingForm from "@/components/property/ViewingForm";

type ActiveModal = "inquiry" | "viewing" | null;

export default function InquiryPanel({
  propertySlug,
  propertyTitle,
}: {
  propertySlug: string;
  propertyTitle: string;
}) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  return (
    <div className="rounded border border-seashell bg-white p-6">
      <p className="font-display text-lg text-ink">Interested in this property?</p>
      <p className="mt-1.5 text-sm text-ink-soft">
        Send a quick message or book a viewing — we&apos;ll connect you with the property owner
        or agent.
      </p>

      <div className="mt-4 space-y-3">
        <Button
          size="lg"
          className="w-full bg-matcha-mist hover:opacity-90"
          onClick={() => setActiveModal("inquiry")}
        >
          <MessageCircle size={18} />
          สอบถามข้อมูลเพิ่มเติม
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full border-matcha-mist text-moss-700 hover:bg-linden-leaf/30"
          onClick={() => setActiveModal("viewing")}
        >
          <CalendarClock size={18} />
          นัดหมายเข้าชม
        </Button>
      </div>

      <Modal
        open={activeModal === "inquiry"}
        onClose={() => setActiveModal(null)}
        title="สอบถามข้อมูลเพิ่มเติม"
        description={`Send us your details and questions about ${propertyTitle}.`}
      >
        <InquiryForm propertySlug={propertySlug} propertyTitle={propertyTitle} />
      </Modal>

      <Modal
        open={activeModal === "viewing"}
        onClose={() => setActiveModal(null)}
        title="นัดหมายเข้าชม"
        description={`Request an in-person or video-call viewing for ${propertyTitle}.`}
      >
        <ViewingForm propertySlug={propertySlug} propertyTitle={propertyTitle} />
      </Modal>
    </div>
  );
}
