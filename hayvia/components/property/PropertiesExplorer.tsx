"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { SlidersHorizontal, X, List as ListIcon, Map as MapIcon } from "lucide-react";
import { districts, getListingType, propertyTypes } from "@/data/properties";
import { isKnownProvince, PROVINCE_AMPHOE } from "@/lib/locations/province-amphoe";
import type { PropertyWithLocation } from "@/lib/properties-source";
import {
  bathroomOptions,
  bedroomOptions,
  budgetOptions,
  defaultFilters,
  provinceOptions,
  sortOptions,
  type PropertiesFilters,
  type SortOption,
} from "@/lib/properties-filters";
import { Select, TextInput } from "@/components/ui/FormField";
import PropertyGrid from "@/components/property/PropertyGrid";
import { cn } from "@/lib/utils";

// Leaflet touches `window` at import time, so the actual map component
// must never be part of the server-rendered tree -- ssr: false is required
// here, not optional. See PropertyMapView.tsx's own header comment.
const PropertyMapView = dynamic(() => import("@/components/property/PropertyMapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded border border-seashell bg-white text-sm text-ink-faint sm:h-[520px]">
      Loading map…
    </div>
  ),
});

export default function PropertiesExplorer({
  properties,
  initialFilters,
}: {
  properties: PropertyWithLocation[];
  initialFilters?: PropertiesFilters;
}) {
  const [filters, setFilters] = useState(initialFilters ?? defaultFilters);
  const [sort, setSort] = useState<SortOption>("Recommended");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

  function updateFilter(key: keyof typeof defaultFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  // Province and Amphoe are a dependent pair here too (same pattern as the
  // admin Property Form). Changing province also resets the flood-safe
  // toggle whenever it moves off Songkhla -- that filter must never stay
  // silently active once its only supported province is no longer selected.
  function handleProvinceChange(next: string) {
    setFilters((prev) => {
      const nextAmphoeOptions = isKnownProvince(next) ? PROVINCE_AMPHOE[next] : [];
      return {
        ...prev,
        province: next as PropertiesFilters["province"],
        amphoe: nextAmphoeOptions.includes(prev.amphoe) ? prev.amphoe : defaultFilters.amphoe,
        floodSafeOnly: next === "Songkhla" ? prev.floodSafeOnly : false,
      };
    });
  }

  function toggleFloodSafeOnly() {
    setFilters((prev) => ({ ...prev, floodSafeOnly: !prev.floodSafeOnly }));
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setSort("Recommended");
  }

  const amphoeOptions = isKnownProvince(filters.province) ? PROVINCE_AMPHOE[filters.province] : [];

  const filtered = useMemo(() => {
    const budget = budgetOptions.find((b) => b.label === filters.budget) ?? budgetOptions[0];

    let result = properties.filter((p) => {
      if (filters.listingType !== "Any" && getListingType(p) !== filters.listingType.toLowerCase())
        return false;
      if (filters.location !== "Any location" && p.district !== filters.location) return false;
      if (filters.province !== "Any province" && p.provinceName !== filters.province) return false;
      if (filters.amphoe !== "Any amphoe" && p.cityName !== filters.amphoe) return false;
      if (filters.propertyType !== "Any type" && p.propertyType !== filters.propertyType)
        return false;
      if (p.price < budget.min || p.price > budget.max) return false;

      // Songkhla flood-safe house inventory -- an additional constraint on
      // top of whatever else is selected, applied ONLY when explicitly
      // toggled on (never filters out UNKNOWN/RISK from normal browsing).
      // Exactly: province = Songkhla AND property_type = HOUSE AND
      // status = PUBLISHED (mapped to "available") AND flood_status = SAFE.
      // Never applied to Phuket -- the toggle itself is only reachable when
      // province = Songkhla (see the Songkhla-gated filter field below and
      // handleProvinceChange, which clears it the moment province changes).
      if (filters.floodSafeOnly) {
        if (p.provinceName !== "Songkhla") return false;
        if (p.propertyType !== "House") return false;
        if (p.status !== "available") return false;
        if (p.floodStatus !== "SAFE") return false;
      }

      if (filters.bedrooms !== "Any") {
        if (filters.bedrooms === "Studio" && p.bedrooms !== 0) return false;
        if (filters.bedrooms === "3+" && p.bedrooms < 3) return false;
        if (["1", "2"].includes(filters.bedrooms) && p.bedrooms !== Number(filters.bedrooms))
          return false;
      }

      if (filters.bathrooms !== "Any") {
        if (filters.bathrooms === "3+" && p.bathrooms < 3) return false;
        if (["1", "2"].includes(filters.bathrooms) && p.bathrooms !== Number(filters.bathrooms))
          return false;
      }

      if (filters.minSize && p.size < Number(filters.minSize)) return false;

      if (filters.furnished !== "Any" && p.furnished !== filters.furnished) return false;

      if (filters.parking === "Required" && !p.parking) return false;

      return true;
    });

    result = [...result];
    if (sort === "Price: Low to High") result.sort((a, b) => a.price - b.price);
    if (sort === "Price: High to Low") result.sort((a, b) => b.price - a.price);
    if (sort === "Newest")
      result.sort(
        (a, b) => new Date(b.availableDate).getTime() - new Date(a.availableDate).getTime()
      );
    if (sort === "Recommended")
      result.sort((a, b) => Number(b.featured) - Number(a.featured));

    return result;
  }, [properties, filters, sort]);

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value !== defaultFilters[key as keyof typeof defaultFilters]
  ).length;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Listing type"
        className="mb-6 inline-flex gap-1 rounded-full border border-seashell bg-white p-1 shadow-card"
      >
        {(["Any", "Rent", "Sale"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={filters.listingType === option}
            onClick={() => updateFilter("listingType", option)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition-colors",
              filters.listingType === option
                ? "bg-matcha-mist text-white"
                : "text-ink-soft hover:bg-kiwi-cream"
            )}
          >
            {option === "Any" ? "All" : option === "Rent" ? "For Rent" : "For Sale"}
          </button>
        ))}
      </div>

      <div
        role="tablist"
        aria-label="View mode"
        className="mb-6 ml-2 inline-flex gap-1 rounded-full border border-seashell bg-white p-1 shadow-card"
      >
        {([
          { key: "list", label: "List", Icon: ListIcon },
          { key: "map", label: "Map", Icon: MapIcon },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              view === key ? "bg-matcha-mist text-white" : "text-ink-soft hover:bg-kiwi-cream"
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="inline-flex items-center gap-2 rounded border border-seashell px-4 py-2.5 text-sm font-medium text-ink"
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-matcha-mist text-xs text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        <Select
          aria-label="Sort properties"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="w-auto"
        >
          {sortOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:mt-0 lg:grid-cols-[260px_1fr]">
        <aside
          className={cn(
            "lg:block",
            mobileFiltersOpen
              ? "fixed inset-0 z-50 overflow-y-auto bg-warm-ivory p-5"
              : "hidden"
          )}
        >
          {mobileFiltersOpen && (
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <p className="font-display text-lg">Filters</p>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded p-1.5 text-ink-soft"
              >
                <X size={20} />
              </button>
            </div>
          )}

          <div className="space-y-6 rounded border border-seashell bg-white p-5">
            <FilterField label="Province">
              <Select value={filters.province} onChange={(e) => handleProvinceChange(e.target.value)}>
                {provinceOptions.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Amphoe">
              <Select
                value={filters.amphoe}
                onChange={(e) => updateFilter("amphoe", e.target.value)}
                disabled={amphoeOptions.length === 0}
              >
                <option>Any amphoe</option>
                {amphoeOptions.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </FilterField>

            {filters.province === "Songkhla" && (
              <FilterField label="Songkhla Flood-Safe Houses">
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={filters.floodSafeOnly}
                    onChange={toggleFloodSafeOnly}
                    className="h-4 w-4 rounded border-line text-moss-600 focus:ring-moss-500/30"
                  />
                  Show flood-safe houses only
                </label>
                <p className="mt-1.5 text-xs text-ink-faint">
                  Published Songkhla houses an admin has classified as Flood Status: Safe. Not a
                  government certification.
                </p>
              </FilterField>
            )}

            <FilterField label="Location">
              <Select
                value={filters.location}
                onChange={(e) => updateFilter("location", e.target.value)}
              >
                <option>Any location</option>
                {districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Property Type">
              <Select
                value={filters.propertyType}
                onChange={(e) => updateFilter("propertyType", e.target.value)}
              >
                <option>Any type</option>
                {propertyTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Monthly Budget">
              <Select
                value={filters.budget}
                onChange={(e) => updateFilter("budget", e.target.value)}
              >
                {budgetOptions.map((b) => (
                  <option key={b.label}>{b.label}</option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Bedrooms">
              <Select
                value={filters.bedrooms}
                onChange={(e) => updateFilter("bedrooms", e.target.value)}
              >
                {bedroomOptions.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Bathrooms">
              <Select
                value={filters.bathrooms}
                onChange={(e) => updateFilter("bathrooms", e.target.value)}
              >
                {bathroomOptions.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Minimum Size (sqm)">
              <TextInput
                type="number"
                min={0}
                value={filters.minSize}
                onChange={(e) => updateFilter("minSize", e.target.value)}
                placeholder="e.g. 30"
              />
            </FilterField>

            <FilterField label="Furnished">
              <Select
                value={filters.furnished}
                onChange={(e) => updateFilter("furnished", e.target.value)}
              >
                <option>Any</option>
                <option>Fully furnished</option>
                <option>Partially furnished</option>
                <option>Unfurnished</option>
              </Select>
            </FilterField>

            <FilterField label="Parking">
              <Select
                value={filters.parking}
                onChange={(e) => updateFilter("parking", e.target.value)}
              >
                <option>Any</option>
                <option>Required</option>
              </Select>
            </FilterField>

            <button
              type="button"
              onClick={resetFilters}
              className="w-full rounded border border-seashell py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-matcha-mist hover:text-moss-700"
            >
              Reset Filters
            </button>

            {mobileFiltersOpen && (
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full rounded bg-matcha-mist py-2.5 text-sm font-medium text-white lg:hidden"
              >
                Show {filtered.length} properties
              </button>
            )}
          </div>
        </aside>

        <div>
          <div className="mb-6 hidden items-center justify-between lg:flex">
            <p className="text-sm text-ink-soft">
              <span className="font-medium text-ink">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "property" : "properties"} found
            </p>
            <Select
              aria-label="Sort properties"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-auto"
            >
              {sortOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </div>
          <p className="mb-4 text-sm text-ink-soft lg:hidden">
            <span className="font-medium text-ink">{filtered.length}</span>{" "}
            {filtered.length === 1 ? "property" : "properties"} found
          </p>

          {view === "map" ? (
            <PropertyMapView properties={filtered} />
          ) : (
            <PropertyGrid
              properties={filtered}
              emptyTitle={
                filters.listingType === "Sale" ? "Sale listings are on the way" : undefined
              }
              emptyDescription={
                filters.listingType === "Sale"
                  ? "We don't have properties for sale listed yet. Browse rentals in the meantime, or list your own property to be added once sale listings open."
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}
