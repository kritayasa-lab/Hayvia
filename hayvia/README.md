# Subphiphat Real Estate — Find Your Place in Thailand

A property rental and matching platform MVP for Hat Yai, Thailand. Built with
Next.js (App Router), React, TypeScript and Tailwind CSS.

This is a lead-generation and matching platform, not a booking engine: visitors
browse selected listings, submit their requirements through **Get Matched**,
and the Subphiphat Real Estate team manually matches them with suitable properties and
introduces them to the property owner or agent.

---

## 1. Requirements

- Node.js 18.17 or later
- npm (comes with Node.js)

## 2. Setup

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

Other commands:

```bash
npm run build   # production build
npm run start   # run the production build locally
npm run lint    # lint the project
```

## 3. Deploying to Vercel

1. Push this project to a GitHub, GitLab, or Bitbucket repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Framework preset: Vercel auto-detects **Next.js** — no changes needed.
4. Build command: `next build` (default). Output directory: default.
5. Click **Deploy**. No environment variables are required for the MVP, since
   form submissions are currently handled locally (see below).
6. Once you connect a real backend for leads, add any required API keys as
   Environment Variables in the Vercel project settings.

---

## 4. Where to edit things

Everything is organized so a non-technical owner can update content without
touching component code.

### Property listings
Edit **`data/properties.ts`**. Each property is a single object in the
`properties` array. To add a new property, copy an existing object, give it a
unique `id` and `slug`, and fill in the fields. It will automatically appear
in:
- the Properties page and its filters
- the homepage's Featured Properties (if `featured: true`)
- its own detail page at `/properties/[slug]`
- the sitemap

To temporarily hide a property without deleting it, set `status` to
`"reserved"` (it will still show but marked as reserved) or remove it from the
array.

### Hat Yai Guide articles
Edit **`data/guides.ts`**. Add a new object to the `guides` array with a
unique `slug`. It will appear on `/guide` and get its own page at
`/guide/[slug]` automatically.

### Contact information
Edit **`config/contact.ts`**. This is the single source of truth for the
WhatsApp number, LINE ID, email address, and social links used across the
Header, Footer, Contact page, and forms. Update the values here and they
change everywhere.

### Branding
- Wordmark: `config/contact.ts` (`brand`) — read by both
  `components/layout/Header.tsx` and `components/layout/Footer.tsx`, so
  renaming the brand is a one-line change.
- Tagline / descriptor: `config/contact.ts` (`tagline`, `descriptor`).
- Colors and type: `tailwind.config.ts` (see the `moss`, `clay`, `ink`, and
  `paper` color tokens) and the font setup in `app/layout.tsx`.

### Images
Sample listing and guide images currently use placeholder URLs from
`picsum.photos` (clearly reliable, non-broken remote images). To use real
photos:
1. Add image files to `public/images/`.
2. Replace the relevant `images` (properties) or `image` (guides) values in
   `data/properties.ts` / `data/guides.ts` with local paths, e.g.
   `/images/my-property-1.jpg`.

---

## 5. Form submissions (leads)

All forms — Get Matched, property inquiries, List Your Property, and Contact
— funnel through a single function: **`submitLead()`** in **`lib/leads.ts`**.

For the MVP, this function logs the submission and resolves successfully so
the full UI (loading, validation, success states) works end-to-end without a
backend. When you're ready to go live, replace the body of `submitLead()`
with a real integration — for example:

- **Supabase / PostgreSQL** — insert into a `leads` table
- **CRM** — POST to your CRM's REST API
- **Email** — send via Resend, Postmark, or SES
- **Google Sheets** — POST to a Google Apps Script web app
- **Webhook** — forward to an automation tool (n8n, Zapier, Make)

Because every form calls the same function, you only need to update this one
file to change how leads are stored.

---

## 6. Project structure

```
app/
  page.tsx                  Homepage
  properties/                /properties (listing + filters)
  properties/[slug]/         /properties/[slug] (detail page)
  get-matched/                /get-matched
  guide/                      /guide (index)
  guide/[slug]/                /guide/[slug] (article page)
  about/                       /about
  list-your-property/          /list-your-property
  contact/                     /contact
  sitemap.ts, robots.ts        SEO
  layout.tsx, globals.css      Root layout & global styles

components/
  layout/     Header, Footer
  property/   PropertyCard, PropertyGrid, PropertiesExplorer (filters),
              ImageGallery, InquiryForm, InquiryPanel
  forms/      GetMatchedForm, ListPropertyForm, ContactForm, ContactButtons
  guide/      GuideCard
  ui/         Button, Badge, Container, SectionHeading, form field primitives

data/
  properties.ts   Single source of truth for all listings
  guides.ts        Single source of truth for all guide articles

lib/
  leads.ts     Isolated lead-submission service (swap for a real backend)
  utils.ts     Formatting and small helpers

config/
  contact.ts   Central contact details used across the site
```

---

## 7. What's intentionally not built yet

This is an MVP. The following are structured for but not implemented, per
the project brief:

- Supabase / database-backed storage
- Admin dashboard, property owner or agent accounts
- CRM / automated lead management
- Automated email, WhatsApp, or LINE notifications
- Thai and Chinese translations
- AI-assisted property matching (matching is manual by design)
- Analytics, saved properties / favorites

Adding these later should not require restructuring the app — `lib/leads.ts`
and `data/properties.ts` are the two seams designed for that.
