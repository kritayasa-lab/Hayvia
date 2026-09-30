import Badge from "@/components/ui/Badge";

const FLOOD_STATUS_LABEL: Record<string, string> = {
  SAFE: "Flood Status: Safe",
  RISK: "Flood Status: Risk",
  UNKNOWN: "Flood Status: Unknown",
};

const FLOOD_STATUS_TONE: Record<string, "moss" | "clay" | "neutral"> = {
  SAFE: "moss",
  RISK: "clay",
  UNKNOWN: "neutral",
};

const CAVEAT =
  "Admin-set classification based on property records — not a government certification or guarantee.";

/**
 * Renders nothing for an unset/unrecognized status (e.g. demo/fallback
 * properties, which never carry flood_status at all) rather than showing a
 * default label — this is purely informational display of an already-set
 * value, never an inferred one.
 */
export default function FloodStatusBadge({ status }: { status?: string }) {
  if (!status || !(status in FLOOD_STATUS_LABEL)) return null;

  return (
    <span title={CAVEAT}>
      <Badge tone={FLOOD_STATUS_TONE[status]}>{FLOOD_STATUS_LABEL[status]}</Badge>
    </span>
  );
}
