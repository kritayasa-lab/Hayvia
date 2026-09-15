import { redirect } from "next/navigation";

// Customer accounts are not part of the public site (guest-first by design
// — see /login for the same decision). Kept as a redirect rather than
// deleted so the route doesn't 404 for anyone with an old bookmark/link, and
// so the underlying profile-fetching logic stays available if it's ever
// reused for an admin-side account view.
export default function AccountPage() {
  redirect("/");
}
