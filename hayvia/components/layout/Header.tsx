"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, User } from "lucide-react";
import Container from "@/components/ui/Container";
import { cn } from "@/lib/utils";
import { contactConfig } from "@/config/contact";
import { signOut } from "@/lib/auth/actions";
import type { CustomerHeaderInfo } from "@/lib/customers/account";

const navLinks = [
  { href: "/properties?listingType=sale", label: "Buy" },
  { href: "/properties?listingType=rent", label: "Rent" },
  { href: "/list-your-property", label: "Sell" },
  { href: "/properties", label: "Properties" },
  { href: "/get-matched", label: "Get Matched" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function accountInitial(account: CustomerHeaderInfo): string {
  const source = account.fullName || account.email || "?";
  return source.charAt(0).toUpperCase();
}

/** Compact avatar-or-initial button + "My Account"/"Sign Out" dropdown, shown once a customer is signed in. Closes on outside click and on route change. */
function AccountMenu({ account }: { account: CustomerHeaderInfo }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-moss-600 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        {account.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          accountInitial(account)
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded border border-line bg-surface py-1 shadow-lg">
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-ink hover:bg-line-soft"
          >
            My Account
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-ink-soft hover:bg-line-soft hover:text-red-600"
            >
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function Header({ account }: { account: CustomerHeaderInfo | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-seashell bg-warm-ivory/90 backdrop-blur">
      <Container>
        <div className="flex h-16 items-center justify-between sm:h-20">
          <Link
            href="/"
            className="whitespace-nowrap font-display text-base tracking-tight text-ink sm:text-lg"
          >
            {contactConfig.brand}
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm transition-colors",
                    active ? "text-ink font-medium" : "text-ink-soft hover:text-ink"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/get-matched"
              className="hidden rounded bg-matcha-mist px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:inline-flex"
            >
              Get Matched
            </Link>
            {account ? (
              <div className="hidden sm:block">
                <AccountMenu account={account} />
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
              >
                <User size={16} />
                Sign In
              </Link>
            )}
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded text-ink lg:hidden"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </Container>

      {open && (
        <div className="fixed inset-x-0 top-16 z-30 h-[calc(100vh-4rem)] overflow-y-auto border-t border-seashell bg-warm-ivory sm:top-20 sm:h-[calc(100vh-5rem)] lg:hidden">
          <Container className="flex flex-col gap-1 py-6">
            {navLinks.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded px-3 py-3.5 text-lg",
                    active ? "bg-linden-leaf text-moss-700 font-medium" : "text-ink"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/get-matched"
              className="mt-4 inline-flex items-center justify-center rounded bg-matcha-mist px-4 py-3.5 text-base font-medium text-white"
            >
              Get Matched
            </Link>
            {account ? (
              <>
                <Link href="/account" className="mt-4 rounded px-3 py-3.5 text-lg text-ink">
                  My Account
                </Link>
                <form action={signOut}>
                  <button type="submit" className="w-full rounded px-3 py-3.5 text-left text-lg text-ink-soft">
                    Sign Out
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login" className="mt-4 rounded px-3 py-3.5 text-lg text-ink">
                Sign In
              </Link>
            )}
          </Container>
        </div>
      )}
    </header>
  );
}
