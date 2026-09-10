// Central place for all contact details and outbound links.
// Update these values and every page that references contact info updates automatically.

export const contactConfig = {
  brand: "HAYVIA",
  tagline: "Your Gateway to Hat Yai",
  descriptor: "Property • Living • Local Services",

  whatsappNumber: "+66812345678", // sample number — replace with real WhatsApp Business number
  whatsappLink: "https://wa.me/66812345678",

  lineId: "@hayvia", // sample LINE Official Account ID
  lineLink: "https://line.me/R/ti/p/@hayvia",

  email: "hello@hayvia.co", // sample email address
  emailLink: "mailto:hello@hayvia.co",

  facebookLink: "https://facebook.com/hayvia",
  instagramLink: "https://instagram.com/hayvia",

  city: "Hat Yai, Songkhla, Thailand",

  siteUrl: "https://hayvia.co", // update to the real production domain before launch
};

export type ContactMethod = "whatsapp" | "line" | "email";
