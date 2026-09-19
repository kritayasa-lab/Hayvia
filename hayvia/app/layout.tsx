import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { contactConfig } from "@/config/contact";
import { getCustomerHeaderInfo } from "@/lib/customers/account";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(contactConfig.siteUrl),
  title: {
    default: "Subphiphat Real Estate | Find Your Home in Hat Yai",
    template: "%s | Subphiphat Real Estate",
  },
  description:
    "Subphiphat Real Estate helps you discover selected rental properties in Hat Yai, Thailand, and get matched with a home that fits your budget, location and lifestyle.",
  openGraph: {
    title: "Subphiphat Real Estate | Find Your Home in Hat Yai",
    description:
      "Discover selected rental properties in Hat Yai and get matched with a home that fits your budget, location and lifestyle.",
    url: contactConfig.siteUrl,
    siteName: "Subphiphat Real Estate",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Subphiphat Real Estate | Find Your Home in Hat Yai",
    description:
      "Discover selected rental properties in Hat Yai and get matched with a home that fits your budget, location and lifestyle.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read once per request, never redirects (see getCustomerHeaderInfo's own
  // comment) — safe to call unconditionally even though this layout wraps
  // every route, /admin/** included.
  const account = await getCustomerHeaderInfo();

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="bg-paper text-ink font-sans antialiased">
        <Header account={account} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
