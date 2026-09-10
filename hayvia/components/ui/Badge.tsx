import { cn } from "@/lib/utils";

type Tone = "moss" | "clay" | "neutral";

export default function Badge({
  children,
  tone = "moss",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const toneStyles: Record<Tone, string> = {
    moss: "bg-moss-50 text-moss-700",
    clay: "bg-clay-100 text-clay-500",
    neutral: "bg-line-soft text-ink-soft",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
