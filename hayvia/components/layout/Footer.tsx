import Link from "next/link";
import { Facebook, Instagram, Mail } from "lucide-react";
import Container from "@/components/ui/Container";
import { contactConfig } from "@/config/contact";

const columns = [
  {
    heading: "Explore",
    links: [
      { href: "/properties", label: "Properties" },
      { href: "/get-matched", label: "Get Matched" },
      { href: "/guide", label: "Hat Yai Guide" },
    ],
  },
  {
    heading: contactConfig.brand,
    links: [
      { href: "/about", label: "About" },
      { href: "/list-your-property", label: "List Your Property" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <Container className="py-14 sm:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="font-display text-xl text-ink">{contactConfig.brand}</p>
            <p className="mt-2 max-w-xs text-sm text-ink-soft">
              {contactConfig.tagline} — {contactConfig.descriptor}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href={contactConfig.facebookLink}
                aria-label={`${contactConfig.brand} on Facebook`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-moss-500 hover:text-moss-700"
              >
                <Facebook size={16} />
              </a>
              <a
                href={contactConfig.instagramLink}
                aria-label={`${contactConfig.brand} on Instagram`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-moss-500 hover:text-moss-700"
              >
                <Instagram size={16} />
              </a>
              <a
                href={contactConfig.emailLink}
                aria-label={`Email ${contactConfig.brand}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-moss-500 hover:text-moss-700"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <p className="text-sm font-medium text-ink">{col.heading}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-soft transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-line-soft pt-6">
          <p className="max-w-3xl text-xs leading-relaxed text-ink-faint">
            Property availability, prices and rental terms may change. Please confirm
            details with the property owner or agent before making any decisions.
          </p>
          <p className="mt-4 text-xs text-ink-faint">
            © 2026 {contactConfig.brand}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
