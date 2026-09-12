"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded border border-line px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-red-300 hover:text-red-600"
      >
        <LogOut size={16} />
        Log Out
      </button>
    </form>
  );
}
