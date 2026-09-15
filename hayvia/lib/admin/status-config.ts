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
  },
};
