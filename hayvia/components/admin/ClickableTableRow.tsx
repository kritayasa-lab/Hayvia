"use client";

import { useRouter } from "next/navigation";

// Makes an entire table row a click target that navigates to `href`, while
// leaving any real <a>/<button> inside the row (e.g. the candidate_code
// link) to handle its own click — a click that starts inside one of those
// is never intercepted, so Ctrl/Cmd-click, middle-click, and "open in new
// tab" on that inner link keep working exactly as before. This is the one
// new piece of navigation plumbing this change adds; everything else reuses
// existing components/patterns (see ConvertRadarCandidateButton.tsx for the
// same "use client" + useRouter() convention already used elsewhere in this
// admin section).
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
