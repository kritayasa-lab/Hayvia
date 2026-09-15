import { requireAdmin } from "@/lib/auth/admin";
import AdminShell from "@/components/admin/AdminShell";

// This layout is the authoritative gate for every /admin/* page EXCEPT
// /admin/login (which lives outside this route group — see its own file
// comment). requireAdmin() redirects to /admin/login for anyone without a
// live session whose profiles.role is ADMIN. Every page nested under
// app/admin/(dashboard)/ inherits this automatically; no individual page
// needs to (or should) repeat the check.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
