"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { districts, propertyTypes } from "@/data/properties";
import { budgetOptions, bedroomOptions } from "@/lib/properties-filters";
import { Select } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";

const ANY_LOCATION = "Any location";
const ANY_TYPE = "Any type";

type Mode = "buy" | "rent";

interface SearchBarProps {
  className?: string;
}

/**
 * Buy / Rent tabs pick the listing type; Sell goes straight to
 * /list-your-property (it isn't a search). Buy + Rent submit to
 * /properties?listingType=...&location=...&type=...&budget=...&bedrooms=...,
 * which PropertiesExplorer reads as its initial filter state (see
 * resolveInitialFilters in lib/properties-filters.ts) — this is a real
 * navigation with real filtering, not a decorative search box.
 */
export default function SearchBar({ className }: SearchBarProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("rent");
  const [propertyType, setPropertyType] = useState(ANY_TYPE);
  const [location, setLocation] = useState(ANY_LOCATION);
  const [budget, setBudget] = useState(budgetOptions[0].label);
  const [bedrooms, setBedrooms] = useState(bedroomOptions[0]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("listingType", mode === "buy" ? "sale" : "rent");
    if (propertyType !== ANY_TYPE) params.set("type", propertyType);
    if (location !== ANY_LOCATION) params.set("location", location);
    if (budget !== budgetOptions[0].label) params.set("budget", budget);
    if (bedrooms !== bedroomOptions[0]) params.set("bedrooms", bedrooms);
    router.push(`/properties?${params.toString()}`);
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-seashell bg-white/95 p-4 shadow-card backdrop-blur-sm sm:p-5",
        className
      )}
    >
      <div className="mb-4 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode("buy")}
          aria-pressed={mode === "buy"}
          className={cn(
            "relative rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
            mode === "buy" ? "bg-matcha-mist text-white" : "text-ink-soft hover:bg-kiwi-cream"
          )}
        >
          Buy
          {mode !== "buy" && (
            <span
              className="absolute right-1 top-1.5 h-1.5 w-1.5 rounded-full bg-sunny-citron"
              aria-hidden="true"
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => setMode("rent")}
          aria-pressed={mode === "rent"}
          className={cn(
            "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
            mode === "rent" ? "bg-matcha-mist text-white" : "text-ink-soft hover:bg-kiwi-cream"
          )}
        >
          Rent
        </button>
        <Link
          href="/list-your-property"
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-old-copper transition-colors hover:bg-old-copper/10"
        >
          Sell
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3">
        <div>
          <label htmlFor="search-type" className="mb-1.5 block text-xs font-medium text-ink-soft">
            Property Type
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

        <div>
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

        <div>
          <label htmlFor="search-budget" className="mb-1.5 block text-xs font-medium text-ink-soft">
            Budget
          </label>
          <Select
            id="search-budget"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
          >
            {budgetOptions.map((option) => (
              <option key={option.label}>{option.label}</option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor="search-bedrooms"
            className="mb-1.5 block text-xs font-medium text-ink-soft"
          >
            Bedrooms
          </label>
          <Select
            id="search-bedrooms"
            value={bedrooms}
            onChange={(event) => setBedrooms(event.target.value)}
          >
            {bedroomOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </Select>
        </div>

        <button
          type="submit"
          className="col-span-2 inline-flex items-center justify-center gap-2 rounded bg-matcha-mist px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:col-span-4"
        >
          <Search size={16} aria-hidden="true" />
          Search Properties
        </button>
      </form>
    </div>
  );
}
