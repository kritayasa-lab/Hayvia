import type { Metadata } from "next";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin Sign In — Subphiphat Real Estate",
  robots: { index: false, follow: false },
};

// Deliberately OUTSIDE app/admin/(dashboard)/ — that group's layout calls
// requireAdmin(), which would redirect back here and create a loop. This
// page itself needs no auth check at all: signing in is exactly how an admin
// session is created in the first place.
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 shadow-card">
        <p className="text-center font-display text-xl text-ink">Subphiphat Real Estate</p>
        <p className="mt-1 text-center text-sm text-ink-faint">Admin Dashboard</p>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
