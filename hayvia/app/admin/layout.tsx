import type { Metadata } from "next";

// Shared shell for the entire /admin tree (login page included). No auth
// check here — that would create a redirect loop for /admin/login. The real
// gate is app/admin/(dashboard)/layout.tsx, which every protected page is
// nested under.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
