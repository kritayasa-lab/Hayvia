"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Property } from "@/data/properties";
import { districts, getListingType, propertyTypes } from "@/data/properties";
import {
  bedroomOptions,
  budgetOptions,
  defaultFilters,
  listingTypeOptions,
  sortOptions,
  type PropertiesFilters,
  type SortOption,
} from "@/lib/properties-filters";
import { Select } from "@/components/ui/FormField";
import PropertyGrid from "@/components/property/PropertyGrid";
import { cn } from "@/lib/utils";

export default function PropertiesExplorer({
  properties,
  initialFilters,
}: {
  properties: Property[];
  initialFilters?: PropertiesFilters;
}) {
  const [filters, setFilters] = useState(initialFilters ?? defaultFilters);
  const [sort, setSort] = useState<SortOption>("Recommended");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  function updateFilter(key: keyof typeof defaultFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setSort("Recommended");
  }

  const filtered = useMemo(() => {
    const budget = budgetOptions.find((b) => b.label === filters.budget) ?? budgetOptions[0];

    let result = properties.filter((p) => {
      if (filters.listingType !== "Any" && getListingType(p) !== filters.listingType.toLowerCase())
        return false;
      if (filters.location !== "Any location" && p.district !== filters.location) return false;
      if (filters.propertyType !== "Any type" && p.propertyType !== filters.propertyType)
        return false;
      if (p.price < budget.min || p.price > budget.max) return false;

      if (filters.bedrooms !== "Any") {
        if (filters.bedrooms === "Studio" && p.bedrooms !== 0) return false;
        if (filters.bedrooms === "3+" && p.bedrooms < 3) return false;
        if (["1", "2"].includes(filters.bedrooms) && p.bedrooms !== Number(filters.bedrooms))
          return false;
      }

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
            <FilterField label="Listing Type">
              <Select
                value={filters.listingType}
                onChange={(e) => updateFilter("listingType", e.target.value)}
              >
                {listingTypeOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </FilterField>

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
