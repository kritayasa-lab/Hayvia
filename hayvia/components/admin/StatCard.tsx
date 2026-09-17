"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatCard({
  label,
  value,
  href,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  href?: string;
  icon?: LucideIcon;
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
        {Icon && (
          <Icon
            size={16}
            className={tone === "accent" ? "text-moss-600" : "text-ink-faint"}
          />
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
