"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { districts, propertyTypes } from "@/data/properties";
import { Select } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";

const ANY_LOCATION = "Any location";
const ANY_TYPE = "Any type";

type Mode = "rent" | "buy";

interface SearchBarProps {
  className?: string;
}

/**
 * Rent / Buy tabs pick the listing type; Sell goes straight to
 * /list-your-property (it isn't a search). Rent + Buy submit to
 * /properties?listingType=...&location=...&type=..., which
 * PropertiesExplorer now reads as its initial filter state (see
 * resolveInitialFilters in PropertiesExplorer.tsx) — this is a real
 * navigation with real filtering, not a decorative search box.
 */
export default function SearchBar({ className }: SearchBarProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("rent");
  const [location, setLocation] = useState(ANY_LOCATION);
  const [propertyType, setPropertyType] = useState(ANY_TYPE);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("listingType", mode === "buy" ? "sale" : "rent");
    if (location !== ANY_LOCATION) params.set("location", location);
    if (propertyType !== ANY_TYPE) params.set("type", propertyType);
    router.push(`/properties?${params.toString()}`);
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-seashell bg-white p-4 shadow-card sm:p-3",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode("rent")}
          aria-pressed={mode === "rent"}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            mode === "rent" ? "bg-matcha-mist text-white" : "text-ink-soft hover:bg-kiwi-cream"
          )}
        >
          Rent
        </button>
        <button
          type="button"
          onClick={() => setMode("buy")}
          aria-pressed={mode === "buy"}
          className={cn(
            "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
            mode === "buy" ? "bg-matcha-mist text-white" : "text-ink-soft hover:bg-kiwi-cream"
          )}
        >
          Buy
          {mode !== "buy" && (
            <span
              className="absolute right-0.5 top-1 h-1.5 w-1.5 rounded-full bg-sunny-citron"
              aria-hidden="true"
            />
          )}
        </button>
        <Link
          href="/list-your-property"
          className="rounded-full px-4 py-2 text-sm font-medium text-old-copper transition-colors hover:bg-old-copper/10"
        >
          Sell
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="search-location"
            className="mb-1.5 block text-xs font-medium text-ink-soft"
          >
            Location
          </label>
          <Select
            id="search-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          >
            <option>{ANY_LOCATION}</option>
            {districts.map((district) => (
              <option key={district}>{district}</option>
            ))}
          </Select>
        </div>

        <div className="flex-1">
          <label
            htmlFor="search-type"
            className="mb-1.5 block text-xs font-medium text-ink-soft"
          >
            Property type
          </label>
          <Select
            id="search-type"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
          >
            <option>{ANY_TYPE}</option>
            {propertyTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </Select>
        </div>

        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-matcha-mist px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:py-[13px]"
        >
          <Search size={16} aria-hidden="true" />
          Search
        </button>
      </form>
    </div>
  );
}
