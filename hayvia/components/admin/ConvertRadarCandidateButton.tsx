"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";

/**
 * The "Approve & Create Property" entry point on a Property Radar candidate.
 * Deliberately does not create a second conversion mechanism — it only
 * navigates to the existing /admin/properties/new?fromRadarCandidate=<id>
 * flow (prefill, DRAFT default, radar_property_candidate_id linkage, and
 * CONVERTED marking are all handled there, unchanged). This component adds
 * nothing but a confirmation step before that navigation.
 */
export default function ConvertRadarCandidateButton({ candidateId }: { candidateId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded bg-moss-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Approve &amp; Create Property
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Create a property from this candidate?">
        <p className="text-sm text-ink-soft">
          This will create a real property record from this Radar candidate. The property will start as
          DRAFT and will not be published automatically.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-ink/20 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => router.push(`/admin/properties/new?fromRadarCandidate=${candidateId}`)}
            className="rounded bg-moss-600 px-4 py-2 text-sm font-medium text-white hover:bg-moss-700"
          >
            Continue
          </button>
        </div>
      </Modal>
    </>
  );
}
