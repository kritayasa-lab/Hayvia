import Badge from "@/components/ui/Badge";

const CAVEAT =
  "Admin-set classification based on property records — not a government certification or guarantee.";

/**
 * Public display rule: only ever shows something for flood_status = SAFE.
 * RISK and UNKNOWN render nothing here -- this is purely a positive
 * "Flood Safe" indicator for public browsing, not a general status
 * display. (The admin Property Form is the one place that still shows
 * all three states -- SAFE/RISK/UNKNOWN -- unaffected by this.)
 */
export default function FloodStatusBadge({ status }: { status?: string }) {
  if (status !== "SAFE") return null;

  return (
    <span title={CAVEAT}>
      <Badge tone="moss">Flood Safe</Badge>
    </span>
  );
}
