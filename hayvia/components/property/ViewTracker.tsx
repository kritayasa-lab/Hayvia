"use client";

import { useEffect, useRef } from "react";

/**
 * Fires a single POST to /api/properties/view when a property detail page
 * loads. Renders nothing. The `useRef` guard prevents a duplicate request
 * from React 18 Strict Mode's development double-invoke of effects — in
 * production this would only ever run once per mount anyway, since the
 * dependency array is empty (a fresh mount happens per page load/refresh,
 * which is expected to count as a view).
 */
export default function ViewTracker({ slug }: { slug: string }) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    fetch("/api/properties/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch(() => {
      // View tracking is non-critical — silently ignore failures so it can
      // never disrupt the visitor's experience of the page.
    });
  }, [slug]);

  return null;
}
