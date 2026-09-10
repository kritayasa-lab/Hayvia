"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Container from "@/components/ui/Container";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/get-matched", label: "Get Matched" },
  { href: "/guide", label: "Hat Yai Guide" },
  { href: "/about", label: "About" },
];

export default function Header() {
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
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <Container>
        <div className="flex h-16 items-center justify-between sm:h-20">
          <Link href="/" className="font-display text-xl tracking-tight text-ink">
            HAYVIA
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
              className="hidden rounded bg-moss-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-moss-700 sm:inline-flex"
            >
              Get Matched
            </Link>
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
        <div className="fixed inset-x-0 top-16 z-30 h-[calc(100vh-4rem)] overflow-y-auto border-t border-line bg-paper sm:top-20 sm:h-[calc(100vh-5rem)] lg:hidden">
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
                    active ? "bg-moss-50 text-moss-700 font-medium" : "text-ink"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/get-matched"
              className="mt-4 inline-flex items-center justify-center rounded bg-moss-600 px-4 py-3.5 text-base font-medium text-white"
            >
              Get Matched
            </Link>
          </Container>
        </div>
      )}
    </header>
  );
}
