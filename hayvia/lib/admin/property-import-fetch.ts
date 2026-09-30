// -----------------------------------------------------------------------------
// AI Property Import — source fetch + HTML extraction
// -----------------------------------------------------------------------------
// Deliberately NOT in lib/ai/ — this module knows nothing about any AI
// provider. It only does two honest, deterministic things: (1) attempt a
// normal server-side fetch of a pasted URL, and (2) if that succeeds, pull
// out readable text + candidate image URLs with cheerio. No headless
// browser, no fake-user-agent tricks, no login/anti-bot bypass of any kind —
// per the "do not bypass anti-bot/login restrictions" requirement, a source
// that blocks a plain, honest request is reported as blocked, not defeated.
//
// Image URLs are extracted here deterministically (og:image, <img src>,
// JSON-LD) rather than asked of the AI model — exact URL strings are more
// reliably reproduced by a parser than by an LLM transcribing them from a
// large block of text, and it keeps the single AI call focused on property
// fields only (see lib/ai/property-import.ts).
// -----------------------------------------------------------------------------

import * as cheerio from "cheerio";

export type FetchSourceFailureReason =
  | "invalid_url"
  | "blocked_or_login_required"
  | "fetch_failed"
  | "sparse_content";

export type FetchSourceResult =
  | { ok: true; text: string; imageUrls: string[] }
  | { ok: false; reason: FetchSourceFailureReason; message: string };

const FETCH_TIMEOUT_MS = 15000;
const MAX_TEXT_LENGTH = 12000;
const MAX_IMAGE_URLS = 20;
const MIN_READABLE_TEXT_LENGTH = 80;

// Hostnames known to be login-walled/bot-blocked for a plain server fetch.
// Used only to give a more specific, honest failure message — never to
// change fetch behavior or attempt to work around the block.
const KNOWN_SOCIAL_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.com",
  "instagram.com",
  "www.instagram.com",
  "l.facebook.com",
]);

const LOGIN_WALL_SIGNALS = [
  "log into facebook",
  "you must log in",
  "log in to continue",
  "sign up to see",
  "see more of this page",
];

function socialBlockedMessage(): string {
  return "This looks like a Facebook/social link, which typically requires login and can't be read automatically.";
}

function resolveUrl(src: string, base: URL): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

function collectImagesFromJsonLd(node: unknown, found: Set<string>): void {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectImagesFromJsonLd(item, found));
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.image === "string") found.add(obj.image);
    if (Array.isArray(obj.image)) {
      obj.image.forEach((item) => typeof item === "string" && found.add(item));
    }
    Object.values(obj).forEach((value) => collectImagesFromJsonLd(value, found));
  }
}

/**
 * Attempts a plain, honest server-side fetch of `rawUrl` and, on success,
 * extracts readable text and candidate image URLs. Never throws — every
 * failure mode (bad URL, network error, blocked response, login wall,
 * JS-rendered/empty page) returns a discriminated `{ ok: false, reason,
 * message }` so the caller can show a clear, specific fallback instead of a
 * dead end.
 */
export async function fetchAndExtractSource(rawUrl: string): Promise<FetchSourceResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url", message: "That doesn't look like a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "invalid_url", message: "Only http/https URLs are supported." };
  }

  const isKnownSocial = KNOWN_SOCIAL_HOSTS.has(url.hostname.toLowerCase());

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          // A normal, honest browser-like header set — not a bypass
          // technique, just enough that ordinary servers don't reject the
          // request purely for looking like a bare script client.
          "User-Agent":
            "Mozilla/5.0 (compatible; SubphiphatPropertyImportBot/1.0; admin-triggered, one-shot)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: "blocked_or_login_required",
        message: isKnownSocial
          ? socialBlockedMessage()
          : `The source blocked this request (HTTP ${response.status}).`,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        reason: "fetch_failed",
        message: `The source returned an error (HTTP ${response.status}).`,
      };
    }
    html = await response.text();
  } catch {
    return {
      ok: false,
      reason: "fetch_failed",
      message: isKnownSocial ? socialBlockedMessage() : "Could not reach that URL.",
    };
  }

  const $ = cheerio.load(html);

  const bodyTextLower = $("body").text().toLowerCase();
  if (LOGIN_WALL_SIGNALS.some((signal) => bodyTextLower.includes(signal))) {
    return {
      ok: false,
      reason: "blocked_or_login_required",
      message: isKnownSocial
        ? socialBlockedMessage()
        : "This page requires logging in and can't be read automatically.",
    };
  }

  const imageUrls = new Set<string>();
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) imageUrls.add(resolveUrl(ogImage, url));
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) imageUrls.add(resolveUrl(src, url));
  });
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text());
      collectImagesFromJsonLd(json, imageUrls);
    } catch {
      // Malformed JSON-LD on the source page — ignore, not our data to fix.
    }
  });

  $("script, style, noscript, nav, footer").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);

  if (text.length < MIN_READABLE_TEXT_LENGTH) {
    return {
      ok: false,
      reason: "sparse_content",
      message: isKnownSocial
        ? socialBlockedMessage()
        : "Couldn't find enough readable content on that page — it may be JavaScript-rendered or mostly images.",
    };
  }

  return {
    ok: true,
    text,
    imageUrls: Array.from(imageUrls).slice(0, MAX_IMAGE_URLS),
  };
}
