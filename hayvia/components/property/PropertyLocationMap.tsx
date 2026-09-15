import { ExternalLink, MapPin } from "lucide-react";

// Only treat a URL as embeddable if it's an actual Google Maps URL — never
// iframe-embed an arbitrary link that happened to be pasted into the
// "Google Maps URL" column/field. Shortened links (maps.app.goo.gl) aren't
// reliably embeddable via the no-API-key `output=embed` technique, so they
// fall back to a plain "open in Google Maps" link instead of a broken
// preview — still fully functional, just no inline preview.
function toEmbedUrl(mapsUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(mapsUrl);
  } catch {
    return null;
  }

  const trustedHosts = ["www.google.com", "google.com", "maps.google.com"];
  if (!trustedHosts.includes(parsed.hostname) || !parsed.pathname.includes("/maps")) {
    return null;
  }

  parsed.searchParams.set("output", "embed");
  return parsed.toString();
}

/**
 * De-duplicates the free-text address against the district name — e.g.
 * location "Thanon Niphat Uthit 3, Central Hat Yai" + district
 * "Central Hat Yai" should read as just the location, not
 * "..., Central Hat Yai, Central Hat Yai". Purely a formatting cleanup of
 * the same real data — nothing invented or dropped.
 */
export function formatLocationSummary(location: string, district: string): string {
  return location.toLowerCase().includes(district.toLowerCase())
    ? location
    : `${location}, ${district}`;
}

export default function PropertyLocationMap({
  googleMapsUrl,
  locationSummary,
}: {
  googleMapsUrl?: string;
  locationSummary: string;
}) {
  const embedUrl = googleMapsUrl ? toEmbedUrl(googleMapsUrl) : null;

  return (
    <div>
      {embedUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-seashell bg-line-soft">
          <iframe
            src={embedUrl}
            title="Property location map"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open this property's location in Google Maps"
            className="absolute inset-0"
          />
        </div>
      ) : googleMapsUrl ? (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-seashell bg-kiwi-cream/30 px-6 py-10 text-center text-sm font-medium text-moss-700 transition-colors hover:bg-kiwi-cream/50"
        >
          <MapPin size={18} /> Open this property&apos;s location in Google Maps
        </a>
      ) : (
        <p className="rounded-2xl border border-dashed border-seashell bg-seashell/30 px-6 py-8 text-center text-sm text-ink-faint">
          Location map unavailable
        </p>
      )}

      {googleMapsUrl && (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-moss-700 hover:underline"
        >
          Open in Google Maps <ExternalLink size={14} />
        </a>
      )}

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{locationSummary}</p>
    </div>
  );
}
