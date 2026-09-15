"use server";

// -----------------------------------------------------------------------------
// Admin sign-in / sign-out Server Actions. Deliberately separate from
// lib/auth/actions.ts (the public customer auth actions) rather than reusing
// signInWithEmail — that action hardcodes a redirect to /account and has no
// concept of an admin role check. This file is the ONLY place a session gets
// promoted into "usable at /admin": sign-in succeeds at the Supabase Auth
// level, then we look up profiles.role and immediately sign the session back
// out again if it isn't ADMIN, so a non-admin can authenticate but can never
// end up with a live session that passes requireAdmin().
// -----------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/auth/actions";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function signInAdmin(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      // Deliberately the same generic message whether the account doesn't
      // exist, the password is wrong, or the account isn't an admin at
      // all — no enumeration of which admin emails are valid.
      return { error: "Incorrect email or password." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      await supabase.auth.signOut();
      return { error: "This account does not have admin access." };
    }
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    return { error: GENERIC_ERROR };
  }

  redirect("/admin");
}

export async function signOutAdmin() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
