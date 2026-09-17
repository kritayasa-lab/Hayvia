"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function StatCard({
  label,
  value,
  href,
  icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  href?: string;
  // A rendered icon element (e.g. `<Building2 size={16} />`), not a bare
  // component reference — StatCard is a Client Component, and passing a
  // component/function reference as a prop from its Server Component callers
  // is not serializable across that boundary (only already-rendered React
  // elements are). Icons are rendered at the call site for this reason.
  icon?: React.ReactNode;
  tone?: "default" | "accent";
}) {
  const router = useRouter();

  const content = (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface p-5 transition-colors",
        href && "hover:border-moss-300"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">{label}</p>
        {icon && (
          <span className={tone === "accent" ? "text-moss-600" : "text-ink-faint"}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-2xl text-ink">{value}</p>
    </div>
  );

  if (href) {
    // Same Router Cache staleness fix as AdminShell's nav links — forces a
    // fresh server fetch of the destination admin page on click.
    return (
      <Link href={href} onClick={() => router.refresh()}>
        {content}
      </Link>
    );
  }
  return content;
}
