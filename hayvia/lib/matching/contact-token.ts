import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// -----------------------------------------------------------------------------
// Signed, tamper-resistant token for Matching contact capture (Phase 4).
//
// Carries a matching_preferences.id across the "show results" -> "optionally
// email me these matches" round trip WITHOUT ever putting the raw id in a
// response the browser can read and replay arbitrarily. The token is a
// stateless HMAC-SHA256-signed payload: `<matchingPreferenceId>:<expiryEpochSeconds>`,
// base64url-encoded, signature appended — verifiable without any database
// lookup or new table (no migration needed).
//
// Verification order matters: signature is checked BEFORE the expiry is even
// read, so a forged/tampered expiry can't be used to extend a token's life —
// tampering with the payload always invalidates the signature first.
// -----------------------------------------------------------------------------

const TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes — see design report for rationale.

function getSecret(): string {
  const secret = process.env.MATCHING_CONTACT_TOKEN_SECRET;
  if (!secret) {
    throw new Error("MATCHING_CONTACT_TOKEN_SECRET is not configured.");
  }
  return secret;
}

function sign(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

/**
 * Creates a signed contact token for the given matching_preferences.id.
 * Throws if MATCHING_CONTACT_TOKEN_SECRET is missing — fail closed. The
 * caller (app/api/match/route.ts) treats this as best-effort and simply
 * omits `contactToken` from its response on failure; it never blocks the
 * matching results themselves.
 */
export function createContactToken(matchingPreferenceId: string): string {
  const secret = getSecret();
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${matchingPreferenceId}:${expiresAt}`;
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  const signature = sign(encodedPayload, secret).toString("base64url");
  return `${encodedPayload}.${signature}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies a contact token's signature and expiration. Returns the
 * matchingPreferenceId ONLY when the signature is valid, unexpired, and the
 * decoded id looks like a UUID — null otherwise (forged, tampered, expired,
 * malformed, or the secret itself is missing). Never throws: every failure
 * mode is a `null`, so callers can treat "invalid" uniformly without a
 * try/catch and without distinguishing why it failed.
 */
export function verifyContactToken(token: string): { matchingPreferenceId: string } | null {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSignature] = parts;
  if (!encodedPayload || !encodedSignature) return null;

  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }

  const expectedSignature = sign(encodedPayload, secret);
  if (providedSignature.length !== expectedSignature.length) return null;
  if (!timingSafeEqual(providedSignature, expectedSignature)) return null;

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const separatorIndex = payload.lastIndexOf(":");
  if (separatorIndex === -1) return null;

  const matchingPreferenceId = payload.slice(0, separatorIndex);
  const expiresAtRaw = payload.slice(separatorIndex + 1);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt)) return null;
  if (Math.floor(Date.now() / 1000) > expiresAt) return null;

  if (!UUID_RE.test(matchingPreferenceId)) return null;

  return { matchingPreferenceId };
}
