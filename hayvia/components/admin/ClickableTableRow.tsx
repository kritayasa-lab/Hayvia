"use client";

import { useRouter } from "next/navigation";

// Makes an entire table row a click target that navigates to `href`, while
// leaving any real <a>/<button> inside the row to handle its own click — a
// click that starts inside one of those is never intercepted, so Ctrl/Cmd-
// click, middle-click, and "open in new tab" on that inner link keep
// working exactly as before. Not currently used by any page (its original
// call sites, the Radar list pages, were removed), but kept as a generic,
// reusable component for a future clickable list.
export default function ClickableTableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      className={className}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
