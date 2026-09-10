import { cn } from "@/lib/utils";

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {eyebrow && (
        <p className="mb-2 text-sm text-moss-700">{eyebrow}</p>
      )}
      <h2 className="font-display text-3xl sm:text-4xl text-ink">{title}</h2>
      {description && (
        <p className="mt-3 text-ink-soft leading-relaxed">{description}</p>
      )}
    </div>
  );
}
