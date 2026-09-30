"use client";

// -----------------------------------------------------------------------------
// Leaflet + OpenStreetMap inventory map. This file must never be imported
// directly at the top of a file that's part of the SSR tree -- Leaflet
// touches `window`/`document` at import time, which throws under Node.
// PropertiesExplorer.tsx loads this via next/dynamic(..., { ssr: false }).
// -----------------------------------------------------------------------------

import { useMemo } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { getListingType } from "@/data/properties";
import type { PropertyWithLocation } from "@/lib/properties-source";
import { formatPrice } from "@/lib/utils";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Leaflet's default marker icon references image files by a relative path
// that breaks under Next.js/webpack bundling (a well-known Leaflet issue,
// not specific to this app). Pointing at the same package version's
// CDN-hosted images sidesteps the bundler entirely rather than wiring up
// asset imports/next.config changes for three small PNGs.
const iconPrototype = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown };
delete iconPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Roughly centers the Songkhla/Phuket coverage area when there are
// currently zero markers to fit (e.g. active filters exclude everything).
// Never a stand-in for any individual property's location.
const DEFAULT_CENTER: [number, number] = [7.6, 100.3];
const DEFAULT_ZOOM = 8;

type PropertyWithCoordinates = PropertyWithLocation & { latitude: number; longitude: number };

function hasCoordinates(p: PropertyWithLocation): p is PropertyWithCoordinates {
  return (
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude)
  );
}

export default function PropertyMapView({ properties }: { properties: PropertyWithLocation[] }) {
  // Properties without valid coordinates were never dropped from `properties`
  // upstream (they still belong in List) -- this view alone omits them from
  // markers, never inventing a location for them.
  const withCoordinates = useMemo(() => properties.filter(hasCoordinates), [properties]);

  const center: [number, number] = useMemo(() => {
    if (withCoordinates.length === 0) return DEFAULT_CENTER;
    const sum = withCoordinates.reduce(
      (acc, p) => [acc[0] + p.latitude, acc[1] + p.longitude] as [number, number],
      [0, 0] as [number, number]
    );
    return [sum[0] / withCoordinates.length, sum[1] / withCoordinates.length];
  }, [withCoordinates]);

  if (withCoordinates.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded border border-seashell bg-white px-6 text-center text-sm text-ink-faint sm:h-[520px]">
        No properties with a saved location match your filters yet.
      </div>
    );
  }

  return (
    <div className="h-[420px] overflow-hidden rounded border border-seashell sm:h-[520px]">
      <MapContainer center={center} zoom={DEFAULT_ZOOM} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup chunkedLoading>
          {withCoordinates.map((property) => (
            <Marker key={property.id} position={[property.latitude, property.longitude]}>
              <Popup minWidth={220}>
                <PropertyPopupContent property={property} />
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

function PropertyPopupContent({ property }: { property: PropertyWithCoordinates }) {
  const forSale = getListingType(property) === "sale";
  const locationLine = [property.district, property.cityName, property.provinceName]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="w-48">
      {/* eslint-disable-next-line @next/next/no-img-element -- small popup
          thumbnail inside a Leaflet Popup portal, not part of the Next
          image pipeline */}
      <img
        src={property.images[0]}
        alt={property.title}
        className="h-24 w-full rounded object-cover"
      />
      <p className="mt-2 text-sm font-medium leading-snug text-ink">{property.title}</p>
      <p className="mt-1 text-sm font-semibold text-ink">
        {formatPrice(property.price)}
        <span className="font-normal text-ink-faint">{forSale ? "" : "/mo"}</span>
      </p>
      {locationLine && <p className="mt-1 text-xs text-ink-soft">{locationLine}</p>}
      <Link
        href={`/properties/${property.slug}`}
        className="mt-2 inline-block text-xs font-medium text-moss-700 hover:underline"
      >
        View Property &rarr;
      </Link>
    </div>
  );
}
