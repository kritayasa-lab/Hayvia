"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors next.config.js's images.remotePatterns exactly. next/image throws
// a hard render error for any hostname not in that allowlist, and property
// photos can now come from arbitrary AI-imported source URLs (see
// lib/admin/property-import-fetch.ts) that will never all be individually
// allowlisted. Widening remotePatterns to a wildcard would reopen that
// allowlist as a safety net for the whole app just to fix property photos
// specifically, so instead this component falls back to a plain <img> for
// exactly the hosts next/image can't safely optimize. That trades away
// next/image's automatic resizing/format-conversion for arbitrary external
// photos only — every other next/image use in the app (site-controlled
// assets) is completely unaffected.
//
// Keep this list in sync with next.config.js if that allowlist ever changes
// — duplicated here rather than imported because next.config.js isn't a
// module a client component can cleanly pull a runtime value from.
const NEXT_IMAGE_ALLOWED_HOSTS = new Set(["picsum.photos", "images.unsplash.com"]);

function isNextImageHost(src: string): boolean {
  try {
    return NEXT_IMAGE_ALLOWED_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/**
 * Drop-in replacement for next/image's <Image> wherever the src may be an
 * arbitrary external URL (property photos, which can now come from AI
 * Property Import) rather than a known, site-controlled asset. Renders
 * <Image> for allowlisted hosts (unchanged behavior/optimization) and a
 * plain <img> for anything else. Either path shows an explicit "image
 * unavailable" placeholder on load failure instead of a broken-image icon
 * or a crashed page.
 */
export default function PropertyImage({
  src,
  alt,
  fill,
  sizes,
  priority,
  className,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-line-soft text-ink-faint",
          fill ? "absolute inset-0" : "aspect-[4/3] w-full",
          className
        )}
      >
        <ImageOff size={20} />
      </div>
    );
  }

  if (!isNextImageHost(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        onError={() => setBroken(true)}
        className={cn(fill && "absolute inset-0 h-full w-full", className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
