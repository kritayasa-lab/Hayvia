import "server-only";
import OpenAI from "openai";
import {
  leadRequirementSchema,
  LEAD_REQUIREMENT_JSON_SCHEMA,
  type LeadRequirementExtraction,
} from "@/lib/radar/lead-requirement-schema";

// -----------------------------------------------------------------------------
// Phase 8D — Lead Intelligence Foundation. Single AI provider (OpenAI GPT-5.6
// Luna), server-side only, called from exactly one place:
// lib/radar/lead-intelligence.ts (itself called from the admin test action
// and from the Apify Dataset promotion flow — see that file). No provider
// abstraction is introduced here — the previous Property AI feature's
// ClaudePropertyAiProvider interface was removed for exactly this reason
// (this PR's cleanup predecessor); this PR's own instructions are equally
// explicit: use ONE provider, do not build a second abstraction on spec
// alone.
//
// AI's ONE job here is classification + requirement extraction — turning
// free-text posts into the structured shape in
// lib/radar/lead-requirement-schema.ts. It never decides whether a lead is
// genuine, never fabricates a missing value, and never touches the database
// directly — this function returns data, the caller decides what (if
// anything) to persist.
// -----------------------------------------------------------------------------

export const LEAD_EXTRACTION_MODEL = "gpt-5.6-luna";

/** The provider responded, but its output failed schema validation — never persisted. */
export class InvalidLeadExtractionError extends Error {}

export type LeadExtractionResult =
  | { configured: true; extraction: LeadRequirementExtraction; modelName: string; modelVersion: string | null }
  | { configured: false };

// Every instruction below exists to prevent one specific failure mode:
// treating the ABSENCE of a detail as evidence the detail is false/zero.
// "หาบ้านหาดใหญ่" (no mention of budget) must produce budget_min/max = null,
// never a guessed number — and a vague, non-specific post must be scored
// with a low intent_score / NOISE_SPAM intent_category rather than forced
// into a confident-looking structured lead.
const SYSTEM_PROMPT = `You classify and extract structured information from a single raw social-media/classifieds post (often Thai, sometimes mixed Thai/English) from a Facebook group in or around Hat Yai, Thailand.

Your ONLY job is classification + extraction. You are not verifying who the poster is, not judging whether the post is trustworthy, and not deciding whether this should become a real lead or a real property listing — a human reviews every result you produce.

Step 1 — classify the post into exactly one "category":
- BUYER: the poster is looking to BUY a property (a demand signal).
- RENTER: the poster is looking to RENT a property (a demand signal).
- SELLER: the poster is OFFERING a property — for sale, for rent, or "เจ้าของปล่อยเอง" (owner listing directly) — a supply signal, not a demand signal. A post describing a specific property's features/condition (e.g. "บ้านน้ำไม่ท่วม 100% บรรยากาศดี") with no indication the poster wants to acquire one is SELLER.
- NOISE: not a real estate demand or supply signal at all (a general question to the group, a joke, an unrelated comment, an ad for something else).

Step 2 — the Lead Qualification Gate. This determines whether the post gets
retained as a Lead Radar record at all, so get it right rather than fast.
Two more fields, on top of "category":

"poster_role" — WHO is posting, not WHAT they're posting about:
- SEEKER: the poster themselves wants to acquire or rent a property.
- OWNER: the poster is the property's owner, offering it themselves (e.g. "เจ้าของปล่อยเอง", "เจ้าของขายเอง").
- AGENT: the poster is a broker/agent/co-agent marketing property inventory — multiple listings, a business-style post, "รับฝากขาย", a phone/Line contact pitched as a professional service rather than a personal sale.
- UNKNOWN: genuinely can't tell from the text — never guess between OWNER and AGENT (or either) when the evidence doesn't support one.

"qualification" — the retained/discarded verdict:
- QUALIFIED: a genuine SEEKER (category BUYER or RENTER) with enough signal (at minimum a real location or property-type constraint, ideally more) that this is worth surfacing as a real lead right away.
- NEEDS_REVIEW: ambiguous — you cannot confidently tell whether this is a genuine seeker, or it's a genuine seeker but too thin to auto-qualify, or poster_role/category themselves are uncertain. This is the correct DEFAULT whenever you are not confident.
- DISCARD: you are CONFIDENT this is not a genuine seeker — a SELLER/OWNER listing, an AGENT/broker inventory post, an advertisement, or NOISE. Only use DISCARD when the evidence clearly supports it, never as a default for "boring" or "low quality" content.

The single most important rule of this gate: a false DISCARD (throwing away
a real seeker) is far worse than a false NEEDS_REVIEW (a human spends 10
seconds looking at something that turns out to be nothing). When genuinely
uncertain, ALWAYS choose NEEDS_REVIEW over DISCARD — never guess toward
DISCARD to seem decisive. poster_role=SEEKER must never be paired with
qualification=DISCARD.

Worked examples:
- "เจ้าของปล่อยเอง คอนโดใกล้ ม.อ. 1 ห้องนอน 25 ตร.ม. 8000/เดือน" → poster_role OWNER, category SELLER, qualification DISCARD (confidently an owner's own listing).
- "รับฝากขาย บ้านหลายหลังในหาดใหญ่ สนใจทักไลน์ได้เลยค่ะ" (an agent-style multi-listing post) → poster_role AGENT, category SELLER, qualification DISCARD.
- "ตามหาบ้านในหาดใหญ่ ขอราคาไม่เกิน 2.5 ล้านค่ะ" → poster_role SEEKER, category BUYER, qualification QUALIFIED (clear seeker, real budget + location).
- "หาคอนโดเช่าแถวคอหงส์ งบ 6000-8000" → poster_role SEEKER, category RENTER, qualification QUALIFIED.
- A post that could be a seeker OR could be an agent quietly fishing for demand, with no decisive signal either way → poster_role UNKNOWN or best guess, qualification NEEDS_REVIEW.
- A short, vague post where even category is unclear → qualification NEEDS_REVIEW, not DISCARD.

Rules, no exceptions:
1. Only extract what the text actually states or clearly implies. If a detail is not present, its field must be null (or, for property_type, "UNKNOWN") — never guess, estimate, or infer a plausible-sounding value.
   Example: "หาบ้านหาดใหญ่" mentions no budget and no flood requirement — budget_min, budget_max must be null, and no flood-related requirement should be invented.
2. budget_min/budget_max mean ONLY a BUYER's or RENTER's budget — what THEY can spend. They are NEVER a SELLER's asking price. If category is SELLER, budget_min and budget_max MUST both be null, even if the post states a price — put that price in "requirements" instead (e.g. field: "asking_price", value: the amount, evidence: the quote). Confusing an asking price with a budget is a serious error because this budget is later compared directly against buyer/renter search criteria.
3. "requirements" is for anything the post expresses that isn't already covered by category/property_type/location/budget/bedrooms_min/timeline — e.g. flood risk, floor level, furnished, bathrooms, near a school, pet-friendly, or (for SELLER) an asking price. Every entry needs a short "field" label, the "value" as you understood it, and "evidence" — a short verbatim (or near-verbatim) quote from the post that justifies it. Never add a requirement you can't quote evidence for.
4. "unknowns" lists the important details a real estate matcher would want that this post simply never mentions (e.g. "budget", "bedrooms", "exact location") — this is expected to be non-empty for a short or vague post.
5. Vague/subjective language (e.g. "ราคาไม่แรง" — "not a high price") is NOT a number. Do not convert it into a budget_max. If you can express it at all, put it in "requirements" with evidence, but leave budget_min/budget_max null.
6. bedrooms_min is the minimum bedroom count stated (e.g. "3 ห้องนอนขึ้นไป" = 3). If a single exact number is given with no "or more" language, still treat it as the minimum — there is no separate maximum field.
7. intent_category reflects how specific and actionable the post is, NOT whether the poster is a genuine/verified customer — it applies to BUYER/RENTER/SELLER alike:
   - STRONG_INTENT: specific, actionable post (clear location + at least one concrete constraint, e.g. budget or bedrooms for a BUYER/RENTER, or clear property facts for a SELLER).
   - PROBABLE_INTENT: a real but under-specified post (e.g. only a location, or only a property type).
   - WEAK_INTENT: vague interest, mostly subjective language.
   - NOISE_SPAM: use this when category is NOISE, or when a BUYER/RENTER/SELLER post is so vague it carries almost no real information.
   intent_score (0-100) should track this — a vague or NOISE post should score low, not be forced into a confident number.
8. confidence (0-100) is your overall confidence in the fields you DID fill in — not in whether the lead/listing is real. A post with one clear, unambiguous fact can have high confidence even if most other fields are null.
9. "reason" is a short (one sentence) explanation of why you chose this category — the first thing a human reviewer reads.
10. Never invent a location. Only fill province/city/district when a real place name is stated; keep it as the poster wrote it (do not translate or normalize it yourself — a separate deterministic step does that).
11. If a post is clearly a demand ask (not a SELLER listing) but never states or implies buy vs. rent — no "ซื้อ"/"เช่า"/"ผ่อน", no per-month price, and no purchase-scale price (a price in ล้าน/million THB implies a purchase, never a rental) — default to category BUYER rather than RENTER: bare "หา" asks in these Hat Yai groups skew toward buy inquiries more often than rental ones. When you use this default, keep confidence and intent_score modest and add "buy vs. rent not stated" to unknowns. Do not use this default when the post gives ANY signal either way, however indirect — a per-month price means RENTER; installment/ownership-transfer language (e.g. "ผ่อนตรงกับเจ้าของ") or a purchase-scale price means BUYER via that actual signal, not this default.
12. A post using "หา"/"ตามหา"/"มองหา" language does NOT automatically mean poster_role=SEEKER — an OWNER or AGENT post can use the exact same words as marketing copy aimed at buyers ("ใครกำลังมองหาคอนโด... ห้องนี้น่าสนใจมากค่ะ" is an AGENT/OWNER post selling one specific unit, not a seeker's own demand ask). Read the WHOLE post: a specific unit description, a price, "พร้อมขาย"/"พร้อมโอน", furniture/amenity lists, or a contact-for-viewing pitch are supply-side signals regardless of what verb the post opens with.
13. qualification is evaluated independently of intent_category/intent_score — a STRONG_INTENT SELLER post is still qualification DISCARD (it's confidently not a seeker), and a WEAK_INTENT/vague genuine seeker post is still qualification QUALIFIED or NEEDS_REVIEW (never DISCARD) depending on how confident you are it's really a seeker at all. Do not let a low intent_score push you toward DISCARD — those are different questions.
14. Output must be valid JSON matching the provided schema exactly, including poster_role and qualification. Do not add commentary outside the JSON.`;

/**
 * Calls the configured OpenAI model to extract structured requirements from
 * one raw post. Returns `{ configured: false }` (never throws) when
 * OPENAI_API_KEY is missing — the caller is responsible for reporting that
 * distinctly from an actual provider failure. Throws for every other
 * failure mode (network/auth/rate-limit, or a response that fails schema
 * validation) so the caller never mistakes a failed call for a successful,
 * empty one.
 */
export async function extractLeadRequirements(rawPostText: string): Promise<LeadExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { configured: false };

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: LEAD_EXTRACTION_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: rawPostText },
    ],
    response_format: { type: "json_schema", json_schema: LEAD_REQUIREMENT_JSON_SCHEMA },
  });

  const choice = response.choices[0];
  if (choice?.message?.refusal) {
    throw new InvalidLeadExtractionError(`OpenAI declined to extract this post: ${choice.message.refusal}`);
  }

  const content = choice?.message?.content;
  if (!content) {
    throw new InvalidLeadExtractionError("OpenAI returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new InvalidLeadExtractionError("OpenAI returned non-JSON content despite structured output mode.");
  }

  // Re-validated here even though the request used strict Structured
  // Outputs — never trust a single validation layer for a database write
  // (the same principle this schema's own comment cites as this codebase's
  // established convention).
  const validated = leadRequirementSchema.safeParse(parsed);
  if (!validated.success) {
    throw new InvalidLeadExtractionError(`OpenAI output failed schema validation: ${validated.error.message}`);
  }

  return {
    configured: true,
    extraction: validated.data,
    modelName: LEAD_EXTRACTION_MODEL,
    modelVersion: response.model || null,
  };
}
