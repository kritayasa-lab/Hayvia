import { redirect } from "next/navigation";

// Phase 5 — passwordless login unifies "register" and "login" into one
// /login entry point (see EmailOtpForm/requestEmailMagicLink: a new email
// creates an account, an existing one signs in, identical UX either way
// until after verification). /register is no longer a distinct
// customer-facing flow — kept as a redirect, not deleted, so an old
// bookmark/link doesn't 404.
export default function RegisterPage() {
  redirect("/login");
}
