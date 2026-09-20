// -----------------------------------------------------------------------------
// Whitelist of which admin-editable "entity" names map to which real table +
// status column + allowed enum values. Shared by the generic
// /api/admin/[entity]/[id] PATCH route (lib/admin/status-config.ts is the
// only thing standing between a request body and an arbitrary UPDATE, so it
// must be a closed list, never derived from the request itself) and by each
// list page, which uses `options` to render the right dropdown.
// -----------------------------------------------------------------------------

export interface StatusEntityConfig {
  table: string;
  column: "status";
  options: string[];
  /**
   * When set, every successful status update also inserts a row into
   * `history.table` recording the transition — see
   * app/api/admin/[entity]/[id]/route.ts, which reads this generically
   * (originally special-cased to "leads" only; generalized in Phase 8C so
   * Radar candidates get the same guarantee without a second hardcoded
   * branch).
   */
  history?: {
    table: string;
    /** Column on `history.table` that holds the entity's id, e.g. "lead_id". */
    idColumn: string;
  };
}

export const statusEntities: Record<string, StatusEntityConfig> = {
  inquiries: {
    table: "inquiries",
    column: "status",
    options: ["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED", "SPAM"],
  },
  viewings: {
    table: "viewings",
    column: "status",
    options: ["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"],
  },
  "seller-leads": {
    table: "seller_leads",
    column: "status",
    options: ["NEW", "CONTACTED", "QUALIFIED", "REJECTED", "CONVERTED"],
  },
  leads: {
    table: "leads",
    column: "status",
    options: ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATING", "WON", "LOST"],
    history: { table: "lead_status_history", idColumn: "lead_id" },
  },
  // Phase 8C — Property Radar. DUPLICATE and CONVERTED are deliberately
  // excluded from this list: DUPLICATE requires a second field (which
  // candidate it duplicates — see markDuplicate() in
  // app/admin/(dashboard)/radar/properties/actions.ts) and CONVERTED must
  // only ever be set as a side effect of actually creating the real
  // property (see createProperty() in
  // app/admin/(dashboard)/properties/actions.ts) — neither transition is
  // safe to expose as a plain one-field dropdown change.
  "radar-property-candidates": {
    table: "radar_property_candidates",
    column: "status",
    options: [
      "DISCOVERED",
      "AI_REVIEWED",
      "QUALIFIED",
      "DISMISSED",
      "CONTACT_PENDING",
      "CONTACTED",
      "OWNER_INTERESTED",
      "OWNER_DECLINED",
      "INFO_COLLECTION",
      "EXPIRED",
    ],
    history: { table: "radar_property_status_history", idColumn: "candidate_id" },
  },
};
