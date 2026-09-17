"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Home,
  Tag,
  Users,
  MessageSquare,
  CalendarClock,
  Sparkles,
  UserPlus,
  UserSquare2,
  Briefcase,
  MapPin,
  Newspaper,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { signOutAdmin } from "@/lib/auth/admin-actions";
import type { AdminUser } from "@/lib/auth/admin";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Properties",
    items: [
      { href: "/admin/properties", label: "All Properties", icon: Building2 },
      { href: "/admin/rent", label: "For Rent", icon: Home },
      { href: "/admin/buy", label: "For Sale", icon: Tag },
    ],
  },
  {
    title: "CRM",
    items: [
      { href: "/admin/customers", label: "Customers", icon: UserSquare2 },
      { href: "/admin/leads", label: "Leads", icon: Users },
      { href: "/admin/inquiries", label: "Inquiries", icon: MessageSquare },
      { href: "/admin/viewings", label: "Viewing Requests", icon: CalendarClock },
      { href: "/admin/matching", label: "Matching Requests", icon: Sparkles },
      { href: "/admin/seller-leads", label: "Seller Leads", icon: UserPlus },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/owners", label: "Owners", icon: UserSquare2 },
      { href: "/admin/agents", label: "Agents", icon: Briefcase },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/locations", label: "Locations", icon: MapPin },
      { href: "/admin/news", label: "News & Guides", icon: Newspaper },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({
  admin,
  children,
}: {
  admin: AdminUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const nav = (
    <nav className="space-y-6">
      {navSections.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {section.title}
          </p>
          <div className="mt-2 space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                // A plain anchor, not next/link — always does a full browser
                // navigation, bypassing the App Router's client Router Cache.
                // That cache can otherwise serve an earlier, stale RSC
                // snapshot of the destination admin page on a soft
                // navigation, showing e.g. "0 leads" until a manual hard
                // refresh even though Supabase already has current data.
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-moss-600 text-white"
                      : "text-ink-soft hover:bg-line-soft hover:text-ink"
                  )}
                >
                  <item.icon size={16} />
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-paper">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-line bg-surface px-4 py-6 lg:block">
          <a href="/admin" className="block px-3">
            <p className="font-display text-lg text-ink">Subphiphat</p>
            <p className="text-xs text-ink-faint">Admin Dashboard</p>
          </a>
          <div className="mt-8">{nav}</div>
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-ink/40"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-line bg-surface px-4 py-6">
              <div className="flex items-center justify-between px-3">
                <div>
                  <p className="font-display text-lg text-ink">Subphiphat</p>
                  <p className="text-xs text-ink-faint">Admin Dashboard</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded p-1.5 text-ink-soft hover:bg-line-soft"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-8">{nav}</div>
            </aside>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded p-1.5 text-ink-soft hover:bg-line-soft lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-soft">
                {admin.fullName || admin.email || "Admin"}
              </span>
              <form action={signOutAdmin}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-ink/20 hover:text-ink"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </form>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
