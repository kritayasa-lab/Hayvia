// -----------------------------------------------------------------------------
// Hat Yai Guide articles
// -----------------------------------------------------------------------------
// Source of truth for /guide and /guide/[slug]. Add a new object to `guides`
// to publish a new article — the index page and article page update
// automatically.
// -----------------------------------------------------------------------------

export interface GuideArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readingTime: string;
  date: string; // ISO date
  image: string;
  content: string[]; // paragraphs, rendered in order
}

export const guides: GuideArticle[] = [
  {
    slug: "where-to-live-in-hat-yai",
    title: "Where to Live in Hat Yai: A Simple Area Guide",
    excerpt:
      "A plain-language overview of Hat Yai's main residential areas, and who each one tends to suit.",
    category: "Neighbourhoods",
    readingTime: "5 min read",
    date: "2026-08-12",
    image: "https://picsum.photos/seed/subphiphat-guide-1/1200/700",
    content: [
      "Hat Yai is compact enough that most areas are within a short drive of each other, but each part of the city has a slightly different character. Knowing the basics before you start looking will save you time.",
      "Central Hat Yai, around Niphat Uthit roads and Lee Gardens Plaza, is the commercial heart of the city. It suits people who want to walk to shops, restaurants and the night market, and who don't mind paying a bit more for that convenience.",
      "Kho Hong sits a short distance from the centre and offers a mix of condos, townhouses and standalone houses at generally lower prices. It's a common choice for tenants who want more space for their budget and are comfortable with a short commute.",
      "The PSU area, around Prince of Songkla University, is dominated by student and staff housing — studios and small apartments, many available on shorter lease terms. It's a practical option if you're studying or working near the university.",
      "Khlong Hae, known for its floating market, has a slower, more residential feel. Housing here tends to be quieter and more spread out, appealing to families or anyone who prefers a calmer setting outside the city centre.",
      "There's no single 'best' area — it depends on your budget, how often you'll need to travel into the centre, and whether you prioritise space or walkability. The Get Matched form asks about your preferred area for exactly this reason.",
    ],
  },
  {
    slug: "cost-of-renting-in-hat-yai",
    title: "How Much Does It Cost to Rent in Hat Yai?",
    excerpt:
      "A realistic look at monthly rental ranges across property types, so you can set expectations before you search.",
    category: "Budgeting",
    readingTime: "4 min read",
    date: "2026-08-05",
    image: "https://picsum.photos/seed/subphiphat-guide-2/1200/700",
    content: [
      "Rental costs in Hat Yai vary widely depending on property type, location and furnishing level. This guide gives general ranges to help you set a realistic budget — always confirm the exact price and what's included with the property owner or agent.",
      "Studios and small apartments, especially near the university, often start from around ฿5,500–8,000 per month. These are typically compact, furnished, and aimed at students or short-term tenants.",
      "One-bedroom condos in central areas tend to fall between ฿10,000–15,000 per month, with fully furnished units at the higher end of that range and older or less central buildings closer to the lower end.",
      "Townhouses and small houses, which offer more space and often a private parking area, generally range from ฿15,000–25,000 per month depending on size, condition and furnishing.",
      "Larger or higher-spec condos and houses aimed at families or professionals can run ฿25,000 and above, particularly in central locations with additional amenities like a pool or fitness room.",
      "Beyond monthly rent, budget for a security deposit (commonly one to two months' rent) and sometimes an advance payment. These terms vary by property, which is why Subphiphat Real Estate lists deposit and lease information on every listing.",
    ],
  },
  {
    slug: "renting-as-a-foreigner-in-hat-yai",
    title: "Renting a Condo in Hat Yai as a Foreigner",
    excerpt:
      "What to expect as a non-Thai tenant renting in Hat Yai, from paperwork to communication.",
    category: "For Foreigners",
    readingTime: "6 min read",
    date: "2026-07-29",
    image: "https://picsum.photos/seed/subphiphat-guide-3/1200/700",
    content: [
      "Renting as a foreigner in Hat Yai is generally straightforward, though the process can feel unfamiliar if you haven't rented in Thailand before. This guide covers the basics.",
      "Most property owners will ask for a copy of your passport and, if applicable, your visa or work permit. Some may also ask for a local contact number, which is one reason Subphiphat Real Estate collects your preferred contact method during matching.",
      "Lease agreements are usually written in Thai, sometimes with an English translation. It's reasonable to ask for time to review the agreement, or to have someone you trust look it over, before signing.",
      "Deposits are typically one to two months' rent, refundable at the end of the lease minus any deductions for damage or unpaid bills. Ask specifically how the deposit will be returned and what condition the unit needs to be in.",
      "Utility billing (electricity and water) is often separate from rent and may be billed at a per-unit rate set by the building rather than the government rate — this is worth confirming upfront so there are no surprises.",
      "Language can be a barrier when dealing directly with an owner who doesn't speak English. This is part of why Subphiphat Real Estate exists: to help translate your requirements clearly and support the introduction between you and the property owner or agent.",
    ],
  },
  {
    slug: "condo-vs-apartment-in-hat-yai",
    title: "Condo vs Apartment in Hat Yai",
    excerpt:
      "The practical differences between condos and apartments in Hat Yai, and how to decide which fits you.",
    category: "Property Types",
    readingTime: "4 min read",
    date: "2026-07-18",
    image: "https://picsum.photos/seed/subphiphat-guide-4/1200/700",
    content: [
      "In Hat Yai, 'condo' and 'apartment' are often used loosely, but there are some practical differences worth understanding when you compare listings.",
      "Condos are typically individually owned units within a larger building, each rented out by its individual owner. They often come with shared facilities like a pool, gym or 24-hour security, and furnishing standards can vary between units in the same building.",
      "Apartments in Hat Yai are usually entire buildings owned and managed by a single landlord or company. Furnishing and maintenance tend to be more consistent unit-to-unit, though shared amenities are often more basic than in condo buildings.",
      "Condos can offer a wider range of styles and price points within one building, since each unit may be furnished and priced differently by its owner. Apartments tend to offer more predictable pricing and a single point of contact for maintenance issues.",
      "Neither type is inherently better — it depends on what you value. If shared facilities and unit variety matter to you, a condo may suit you. If you prefer consistent management and a single point of contact, an apartment may be simpler.",
    ],
  },
  {
    slug: "what-to-check-before-renting",
    title: "What to Check Before Renting a Property in Thailand",
    excerpt:
      "A practical checklist to review before you commit to a rental property in Hat Yai.",
    category: "Practical Tips",
    readingTime: "5 min read",
    date: "2026-07-02",
    image: "https://picsum.photos/seed/subphiphat-guide-5/1200/700",
    content: [
      "Before signing a lease anywhere in Thailand, it's worth working through a short checklist. None of this is unique to Hat Yai, but it's easy to overlook when you're excited about a new place.",
      "Confirm the exact monthly rent, deposit amount, and what's included — some listings include water and internet, others don't. Get this in writing, even if it's a simple message thread.",
      "Ask about the minimum lease term and what happens if you need to leave early. Early termination policies vary significantly between owners.",
      "Check the condition of furniture, appliances and fixtures at move-in, ideally with photos or a short video, so there's a clear record for when you move out.",
      "Confirm how utility bills are calculated and paid — some buildings bill electricity at a higher per-unit rate than others, which can meaningfully affect your monthly cost.",
      "Ask how maintenance requests are handled and who to contact if something breaks. A responsive owner or building management team makes a real difference over a multi-month stay.",
      "Finally, keep a copy of your signed agreement and any payment receipts. These details matter more than they seem to at move-in, and having them recorded avoids disputes later.",
    ],
  },
];

export function getGuideBySlug(slug: string): GuideArticle | undefined {
  return guides.find((g) => g.slug === slug);
}
