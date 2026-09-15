import { redirect } from "next/navigation";

// Customer login/registration is not part of the public site — the public
// property experience is guest-first (Get Matched, property inquiries and
// viewing requests all work without an account). This route is kept (rather
// than deleted) so the underlying Supabase Auth plumbing and LoginForm
// component remain intact and reusable for a future dedicated admin login
// page, but it's no longer a public entry point — visiting it just sends
// you home.
export default function LoginPage() {
  redirect("/");
}
