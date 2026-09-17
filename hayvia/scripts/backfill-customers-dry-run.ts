// =============================================================================
// scripts/backfill-customers-dry-run.ts
// =============================================================================
// Phase 5A — Historical Customer Backfill: READ-ONLY DRY RUN.
//
// THIS SCRIPT IS READ-ONLY. It performs SELECT queries against Supabase
// ONLY. It never inserts, updates, or deletes any row — not in `customers`,
// not in any of the five source tables, not in `audit_logs`. It never calls
// findOrCreateCustomer() (which writes) or any /api/* write endpoint. It
// never touches Google Sheets. Running it any number of times, in any
// order, changes nothing in the database. The only thing it writes is a
// local JSON report file on disk.
//
// WHAT IT DOES
// For each of inquiries / leads / viewings / seller_leads /
// matching_preferences, it finds every row with customer_id IS NULL that
// has usable contact info, and classifies it — using the exact same
// matching rule as the live findOrCreateCustomer() write path (shared via
// lib/customers/lookup.ts, so the two can never drift apart) — as one of:
//   - MATCH_EXISTING        — resolves (by exact normalized email and/or
//                              exact normalized E.164 phone) to exactly one
//                              existing customers row.
//   - WOULD_CREATE_CUSTOMER — has valid, usable contact info that matches
//                              no existing customer; a real backfill run
//                              would create a new customers row.
//   - CONFLICT              — normalized email and normalized phone each
//                              match a DIFFERENT existing customer. Left
//                              alone — never guessed, never merged.
//   - UNRESOLVED            — no usable email or phone at all (or neither
//                              normalizes to something valid). Cannot be
//                              backfilled by this or any deterministic
//                              process.
// It also reports summary counts for the `customers` table itself (total,
// with email, with phone, with both) for context.
//
// Matching rules (identical to the approved Phase 4/5 design, enforced by
// the single shared implementation in lib/customers/lookup.ts):
//   - exact normalized email only
//   - exact normalized E.164 phone only
//   - if both resolve, they must point at the SAME existing customer, or
//     it's a CONFLICT
//   - never matched by name alone
//   - never uses property/session/IP/timing or any other heuristic
//   - never merges two existing customers under any circumstance
//
// HOW TO RUN IT
//   1. Set two environment variables (the same two the app itself already
//      uses server-side — see lib/supabase/admin.ts):
//        NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=<service role key>
//      Never commit these, never paste them into chat/logs — this script
//      will refuse to run (exit 1, before any network call) if either is
//      missing, and never logs the value of either.
//   2. From the `hayvia/` directory:
//        NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//          node scripts/backfill-customers-dry-run.ts
//      Requires Node 22.6+ (native TypeScript execution — no build step,
//      no ts-node/tsx dependency needed). On Node 22.6–22.17 you may need:
//        node --experimental-strip-types scripts/backfill-customers-dry-run.ts
//      A harmless "MODULE_TYPELESS_PACKAGE_JSON" warning may print — this
//      repo's package.json has no "type" field; it doesn't affect the
//      script's correctness or its read-only guarantee.
//   3. The script prints a summary to stdout and writes the full per-record
//      report to scripts/output/backfill-dry-run-<timestamp>.json (this
//      directory is gitignored — the report contains real customer PII
//      (emails/phones) and must never be committed).
//   4. Review the report. Nothing has been changed. The real backfill
//      (scripts/backfill-customers.ts) does not exist yet and is a
//      separate, explicitly approved step — this script cannot trigger it.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { lookupCustomerByContact, normalizeEmail } from "../lib/customers/lookup.ts";

// -----------------------------------------------------------------------------
// Environment — fail closed, before any network call, and never log values.
// -----------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script. See the header comment in this file for details."
    );
    process.exit(1);
  }
  return value;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// -----------------------------------------------------------------------------
// Phone normalization — intentionally NOT imported from lib/auth/phone.ts,
// which starts with `import "server-only"`. That guard only becomes a no-op
// under Next.js's bundler (the "react-server" export condition); run
// directly by plain `node`, it throws immediately. This is the same
// implementation (libphonenumber-js, default country TH), kept deliberately
// tiny so it's easy to keep in sync with lib/auth/phone.ts's
// normalizeToE164() by inspection.
// -----------------------------------------------------------------------------

function normalizeToE164(rawInput: string, defaultCountry: "TH" = "TH"): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Classification = "MATCH_EXISTING" | "WOULD_CREATE_CUSTOMER" | "CONFLICT" | "UNRESOLVED";
type MatchMethod = "email" | "phone" | "both" | null;

interface RecordResult {
  table: string;
  id: string;
  contactSource: "own_row" | "linked_matching_lead";
  rawEmail: string | null;
  rawPhone: string | null;
  normalizedEmail: string | null;
  normalizedPhoneE164: string | null;
  classification: Classification;
  matchedCustomerId: string | null;
  matchMethod: MatchMethod;
  conflict: { emailCustomerId: string; phoneCustomerId: string } | null;
}

interface SourceRow {
  id: string;
  email: string | null;
  phone: string | null;
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Paginated, read-only fetch of every row with customer_id IS NULL. SELECT only. */
async function fetchNullCustomerRows(
  table: string,
  columns: string,
  pageSize = 500
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .is("customer_id", null)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/**
 * Classifies one (table, row) pair — read-only, issues at most two SELECTs
 * via lookupCustomerByContact(). Never writes.
 */
async function classify(
  table: string,
  row: SourceRow,
  contactSource: RecordResult["contactSource"]
): Promise<RecordResult> {
  const normalizedEmail = normalizeEmail(row.email);
  const normalizedPhoneE164 = row.phone ? normalizeToE164(row.phone) : null;

  const base = {
    table,
    id: row.id,
    contactSource,
    rawEmail: row.email,
    rawPhone: row.phone,
    normalizedEmail,
    normalizedPhoneE164,
  };

  if (!normalizedEmail && !normalizedPhoneE164) {
    return {
      ...base,
      classification: "UNRESOLVED",
      matchedCustomerId: null,
      matchMethod: null,
      conflict: null,
    };
  }

  const lookup = await lookupCustomerByContact(supabase, normalizedEmail, normalizedPhoneE164);

  if (lookup.status === "conflict") {
    return {
      ...base,
      classification: "CONFLICT",
      matchedCustomerId: null,
      matchMethod: null,
      conflict: { emailCustomerId: lookup.emailMatch!.id, phoneCustomerId: lookup.phoneMatch!.id },
    };
  }

  if (lookup.status === "matched") {
    const matchMethod: MatchMethod = lookup.emailMatch && lookup.phoneMatch ? "both" : lookup.emailMatch ? "email" : "phone";
    return {
      ...base,
      classification: "MATCH_EXISTING",
      matchedCustomerId: lookup.customer!.id,
      matchMethod,
      conflict: null,
    };
  }

  return {
    ...base,
    classification: "WOULD_CREATE_CUSTOMER",
    matchedCustomerId: null,
    matchMethod: null,
    conflict: null,
  };
}

// -----------------------------------------------------------------------------
// Per-table audit
// -----------------------------------------------------------------------------

async function auditSimpleTable(
  table: string,
  emailColumn: string,
  phoneColumn: string
): Promise<RecordResult[]> {
  const rows = await fetchNullCustomerRows(table, `id, ${emailColumn}, ${phoneColumn}`);
  const results: RecordResult[] = [];
  // Sequential on purpose — this is a one-time audit against a production
  // database; gentler load beats speed here.
  for (const row of rows) {
    const sourceRow: SourceRow = {
      id: String(row.id),
      email: (row[emailColumn] as string | null) ?? null,
      phone: (row[phoneColumn] as string | null) ?? null,
    };
    results.push(await classify(table, sourceRow, "own_row"));
  }
  return results;
}

/**
 * matching_preferences has NO email/phone column of its own (confirmed in
 * the Phase 4 design audit) — the only place a MATCHING run's contact info
 * can live is on its linked `leads` row (leads.matching_preference_id),
 * populated only if a visitor used the Phase 4 "email me these matches"
 * capture. So: fetch customer_id-null matching_preferences rows, then
 * batch-look-up their linked MATCHING leads rows for customer_email/
 * customer_phone. A row with no linked lead, or a linked lead with no
 * captured contact info, is UNRESOLVED — structurally, not from a bug.
 */
async function auditMatchingPreferences(): Promise<RecordResult[]> {
  const prefRows = await fetchNullCustomerRows("matching_preferences", "id");
  if (prefRows.length === 0) return [];

  const prefIds = prefRows.map((r) => String(r.id));
  const contactByPrefId = new Map<string, { email: string | null; phone: string | null }>();

  for (const idBatch of chunk(prefIds, 200)) {
    const { data, error } = await supabase
      .from("leads")
      .select("matching_preference_id, customer_email, customer_phone")
      .eq("source_type", "MATCHING")
      .in("matching_preference_id", idBatch);
    if (error) throw new Error(`Failed to read leads for matching_preferences lookup: ${error.message}`);
    for (const lead of data ?? []) {
      const prefId = lead.matching_preference_id as string;
      contactByPrefId.set(prefId, {
        email: (lead.customer_email as string | null) ?? null,
        phone: (lead.customer_phone as string | null) ?? null,
      });
    }
  }

  const results: RecordResult[] = [];
  for (const row of prefRows) {
    const id = String(row.id);
    const contact = contactByPrefId.get(id) ?? { email: null, phone: null };
    results.push(
      await classify(
        "matching_preferences",
        { id, email: contact.email, phone: contact.phone },
        "linked_matching_lead"
      )
    );
  }
  return results;
}

async function auditCustomersSummary() {
  // Informational only — customers is the target table, not something with
  // its own customer_id to resolve. Paginated read-only counts.
  let total = 0;
  let withEmail = 0;
  let withPhone = 0;
  let withBoth = 0;
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("customers")
      .select("email, phone_e164")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to read customers: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      total += 1;
      const hasEmail = Boolean(row.email);
      const hasPhone = Boolean(row.phone_e164);
      if (hasEmail) withEmail += 1;
      if (hasPhone) withPhone += 1;
      if (hasEmail && hasPhone) withBoth += 1;
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { total, withEmail, withPhone, withBoth };
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  console.log("Phase 5A — Historical Customer Backfill dry run (READ-ONLY, no writes)");
  console.log(`Supabase project: ${SUPABASE_URL}`);
  console.log("");

  const allResults: RecordResult[] = [];

  console.log("Auditing inquiries...");
  allResults.push(...(await auditSimpleTable("inquiries", "email", "phone")));

  console.log("Auditing leads...");
  allResults.push(...(await auditSimpleTable("leads", "customer_email", "customer_phone")));

  console.log("Auditing viewings...");
  allResults.push(...(await auditSimpleTable("viewings", "customer_email", "customer_phone")));

  console.log("Auditing seller_leads...");
  allResults.push(...(await auditSimpleTable("seller_leads", "email", "phone")));

  console.log("Auditing matching_preferences...");
  allResults.push(...(await auditMatchingPreferences()));

  console.log("Summarizing customers...");
  const customersSummary = await auditCustomersSummary();

  // ---- Summaries ----
  const byTable: Record<string, number> = {};
  const byClassification: Record<Classification, number> = {
    MATCH_EXISTING: 0,
    WOULD_CREATE_CUSTOMER: 0,
    CONFLICT: 0,
    UNRESOLVED: 0,
  };
  const byTableAndClassification: Record<string, Record<Classification, number>> = {};

  for (const r of allResults) {
    byTable[r.table] = (byTable[r.table] ?? 0) + 1;
    byClassification[r.classification] += 1;
    byTableAndClassification[r.table] ??= {
      MATCH_EXISTING: 0,
      WOULD_CREATE_CUSTOMER: 0,
      CONFLICT: 0,
      UNRESOLVED: 0,
    };
    byTableAndClassification[r.table][r.classification] += 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    supabaseProject: SUPABASE_URL,
    summary: {
      totalRecordsAudited: allResults.length,
      byTable,
      byClassification,
      byTableAndClassification,
      customers: customersSummary,
    },
    records: allResults,
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `backfill-dry-run-${report.generatedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log("=== Summary ===");
  console.log("By table (rows with customer_id IS NULL and any usable contact path):");
  console.table(byTable);
  console.log("By classification:");
  console.table(byClassification);
  console.log("Customers table:", customersSummary);
  console.log("");
  console.log(`Full report written to: ${outPath}`);
  console.log("No database writes were performed. No audit_logs entries were written.");
}

main().catch((error) => {
  console.error("Dry run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
