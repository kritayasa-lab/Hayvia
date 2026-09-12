import "server-only";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalizes a user-entered phone number to E.164 (e.g. "+66812345678")
 * before it's ever sent to Supabase Auth. Supabase's phone auth expects
 * E.164 — passing inconsistent formats ("081-234-5678", "0812345678",
 * "66812345678") for the same real number would make Supabase treat them as
 * different identifiers, defeating the whole point of phone-based identity.
 *
 * Defaults to Thailand (TH) since that's the primary market, but correctly
 * parses numbers that already include a country code (e.g. Malaysian or
 * Singaporean visitors entering "+60..." or "+65...").
 *
 * Returns null if the input isn't a valid phone number at all — the caller
 * should show a validation error rather than sending garbage to Supabase.
 */
export function normalizeToE164(rawInput: string, defaultCountry: "TH" = "TH"): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;

  return parsed.number; // already E.164, e.g. "+66812345678"
}

/**
 * Masks all but the country code and last 3 digits, for display only
 * (e.g. "+66812345678" -> "+66•••••678"). Never used for anything other
 * than showing the user which number a code was sent to.
 */
export function maskPhoneForDisplay(e164Phone: string): string {
  if (e164Phone.length <= 6) return e164Phone;
  const visibleStart = e164Phone.slice(0, 3);
  const visibleEnd = e164Phone.slice(-3);
  return `${visibleStart}${"•".repeat(Math.max(e164Phone.length - 6, 3))}${visibleEnd}`;
}
