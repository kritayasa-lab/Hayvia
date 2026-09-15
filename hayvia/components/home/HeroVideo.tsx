"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const POSTER_SRC = "/images/subphiphat-hero-poster.jpg";
const MP4_SRC = "/videos/subphiphat-hero.mp4";
const WEBM_SRC = "/videos/subphiphat-hero.webm";

/**
 * Full-bleed cinematic hero background: video on capable, motion-tolerant
 * desktop/tablet viewports, poster-only everywhere else (small screens,
 * prefers-reduced-motion, or if the video sources fail to load/aren't
 * present yet). The <video> element is only ever mounted in the DOM once
 * we've decided it's safe to play — never rendered-then-hidden — so a
 * phone never issues a request for the video file at all.
 *
 * Asset drop-in: once real files exist at the three paths above, this
 * component needs no changes — it already points at them.
 */
export default function HeroVideo({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [canPlayVideo, setCanPlayVideo] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isLargeViewport = window.matchMedia("(min-width: 768px)").matches;
    setCanPlayVideo(!reduceMotion && isLargeViewport);
  }, []);

  const showVideo = canPlayVideo && !videoFailed;

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      {/* Poster is always in the DOM — it's the LCP element and the
          permanent fallback for mobile / reduced-motion / video-unavailable.
          If it 404s too (asset not dropped in yet), fall back to a plain
          brand-toned gradient so the hero never shows a broken-image icon. */}
      {posterFailed ? (
        <div className="absolute inset-0 bg-gradient-to-br from-kiwi-cream via-warm-ivory to-linden-leaf" />
      ) : (
        <Image
          src={POSTER_SRC}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          onError={() => setPosterFailed(true)}
        />
      )}

      {showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={POSTER_SRC}
          aria-hidden="true"
          onError={() => setVideoFailed(true)}
        >
          <source src={WEBM_SRC} type="video/webm" />
          <source src={MP4_SRC} type="video/mp4" />
        </video>
      )}

      {/* Soft neutral scrim — darker toward the bottom, where the search
          card and copy sit, so they stay readable over any footage. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/25 to-ink/10"
        aria-hidden="true"
      />

      <div className="relative">{children}</div>
    </div>
  );
}
