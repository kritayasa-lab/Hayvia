// Central place for all contact details and outbound links.
// Update these values and every page that references contact info updates automatically.

export const contactConfig = {
  brand: "Subphiphat Real Estate",
  tagline: "Find Your Place in Thailand.",
  descriptor: "Property • Living • Local Services",

  whatsappNumber: "+66812345678", // sample number — replace with real WhatsApp Business number
  whatsappLink: "https://wa.me/66812345678",

  lineId: "@subphiphatrealestate", // sample LINE Official Account ID
  lineLink: "https://line.me/R/ti/p/@subphiphatrealestate",

  email: "hello@subphiphatrealestate.com", // sample email address
  emailLink: "mailto:hello@subphiphatrealestate.com",

  facebookLink: "https://facebook.com/subphiphatrealestate",
  instagramLink: "https://instagram.com/subphiphatrealestate",

  city: "Hat Yai, Songkhla, Thailand",

  // Preferred production domain (see section 27) — must be purchased/configured
  // separately; this repo does not and cannot claim the domain is live.
  siteUrl: "https://subphiphatrealestate.com",
};

export type ContactMethod = "whatsapp" | "line" | "email";
