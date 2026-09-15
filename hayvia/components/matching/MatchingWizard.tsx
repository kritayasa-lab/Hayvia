"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { districts, propertyTypes, type District, type PropertyType } from "@/data/properties";
import {
  bedroomOptions,
  bathroomOptions,
  budgetOptions,
} from "@/lib/properties-filters";
import { supportedLifestyleTags, type LifestyleTag } from "@/lib/matching/types";
import { FieldWrapper, TextInput, Select, RadioPillGroup } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import PropertyCard from "@/components/property/PropertyCard";
import { contactConfig } from "@/config/contact";
import type { Property } from "@/data/properties";

const lifestyleLabels: Record<LifestyleTag, string> = {
  WIFI: "WiFi included",
  POOL: "Swimming pool",
  GYM: "Gym / fitness room",
};

const breakdownLabels: Array<{ key: keyof MatchApiResult["breakdown"]; label: string }> = [
  { key: "budget", label: "Budget" },
  { key: "location", label: "Location" },
  { key: "propertyType", label: "Property Type" },
  { key: "bedrooms", label: "Bedrooms" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "amenities", label: "Amenities" },
  { key: "availability", label: "Availability" },
];

interface FormState {
  purpose: "rent" | "sale";
  preferredAreas: District[];
  propertyType: PropertyType | "Any";
  budget: string;
  bedrooms: string;
  bathrooms: string;
  minSizeSqm: string;
  furnished: string;
  parking: "Required" | "Not important";
  moveInDate: string;
  lifestyle: LifestyleTag[];
}

const initialState: FormState = {
  purpose: "rent",
  preferredAreas: [],
  propertyType: "Any",
  budget: budgetOptions[0].label,
  bedrooms: "Any",
  bathrooms: "Any",
  minSizeSqm: "",
  furnished: "No preference",
  parking: "Not important",
  moveInDate: "",
  lifestyle: [],
};

interface MatchApiResult {
  property: Property;
  overall: number;
  breakdown: {
    budget: number;
    location: number;
    propertyType: number;
    bedrooms: number;
    lifestyle: number;
    amenities: number;
    availability: number;
  };
  reasons: string[];
}

type Step = "form" | "loading" | "results" | "error";

export default function MatchingWizard() {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormState>(initialState);
  const [results, setResults] = useState<MatchApiResult[]>([]);
  const [saved, setSaved] = useState(true);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArea(district: District) {
    setForm((prev) => ({
      ...prev,
      preferredAreas: prev.preferredAreas.includes(district)
        ? prev.preferredAreas.filter((d) => d !== district)
        : [...prev.preferredAreas, district],
    }));
  }

  function toggleLifestyle(tag: LifestyleTag) {
    setForm((prev) => ({
      ...prev,
      lifestyle: prev.lifestyle.includes(tag)
        ? prev.lifestyle.filter((t) => t !== tag)
        : [...prev.lifestyle, tag],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("loading");
    setErrorMessage(null);

    const budget = budgetOptions.find((b) => b.label === form.budget) ?? budgetOptions[0];

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: form.purpose,
          preferredAreas: form.preferredAreas,
          propertyType: form.propertyType,
          budgetMin: budget.min === 0 ? undefined : budget.min,
          budgetMax: Number.isFinite(budget.max) ? budget.max : undefined,
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          minSizeSqm: form.minSizeSqm ? Number(form.minSizeSqm) : undefined,
          furnished: form.furnished,
          parking: form.parking,
          moveInDate: form.moveInDate || undefined,
          lifestyle: form.lifestyle,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.error || "Something went wrong. Please try again.");
        setStep("error");
        return;
      }

      setResults(data.results);
      setSaved(Boolean(data.saved));
      setTotalCandidates(data.totalCandidates ?? 0);
      setStep("results");
    } catch {
      setErrorMessage("Something went wrong. Please check your connection and try again.");
      setStep("error");
    }
  }

  function startOver() {
    setForm(initialState);
    setResults([]);
    setStep("form");
  }

  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-seashell bg-white py-24 text-center">
        <Loader2 className="mb-4 animate-spin text-matcha-mist" size={32} />
        <p className="font-display text-xl text-ink">Finding properties that match your needs...</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="rounded-2xl border border-seashell bg-white p-8 text-center sm:p-12">
        <p className="font-display text-xl text-ink">We couldn&apos;t run your match</p>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">{errorMessage}</p>
        <Button size="lg" className="mt-6 bg-matcha-mist hover:opacity-90" onClick={() => setStep("form")}>
          Try Again
        </Button>
      </div>
    );
  }

  if (step === "results") {
    return (
      <div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="font-display text-2xl text-ink sm:text-3xl">Your Top {results.length} Matches</h2>
          {results.length < 3 && (
            <p className="max-w-md text-sm text-ink-soft">
              {totalCandidates === 0
                ? `We don't have any ${form.purpose === "rent" ? "rental" : "sale"} properties in our current inventory to match against yet.`
                : `Only ${results.length} ${results.length === 1 ? "property" : "properties"} currently ${
                    results.length === 1 ? "matches" : "match"
                  } your criteria this closely — here's the best of what's available.`}
            </p>
          )}
          {!saved && (
            <p className="max-w-md text-xs text-ink-faint">
              Note: we couldn&apos;t save your request for our team to follow up right now, but these
              matches are real and up to date.
            </p>
          )}
        </div>

        <div className="mt-10 space-y-8">
          {results.map((result, index) => (
            <div key={result.property.id} className="rounded-2xl border border-seashell bg-white p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                <div>
                  <PropertyCard property={result.property} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-linden-leaf px-4 py-1.5 font-display text-lg text-moss-700">
                      {result.overall}% Match
                    </span>
                    <span className="text-xs uppercase tracking-wide text-ink-faint">Match #{index + 1}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                    {breakdownLabels.map(({ key, label }) => (
                      <div key={key}>
                        <p className="text-xs text-ink-faint">{label}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-seashell">
                            <div
                              className="h-full rounded-full bg-matcha-mist"
                              style={{ width: `${result.breakdown[key]}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-ink">{result.breakdown[key]}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {result.reasons.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                        Why this matches you
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {result.reasons.map((reason) => (
                          <li key={reason} className="flex items-start gap-2 text-sm text-ink-soft">
                            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-moss-600" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 border-t border-line pt-8 text-center">
          <p className="text-sm text-ink-soft">Have questions about any of these matches?</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={contactConfig.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded bg-matcha-mist px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle size={16} />
              Contact Us
            </Link>
            <button
              type="button"
              onClick={startOver}
              className="inline-flex items-center justify-center gap-2 rounded border border-seashell px-6 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-matcha-mist hover:text-moss-700"
            >
              <RotateCcw size={15} />
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10" noValidate>
      <FormSection title="What are you looking for?">
        <FieldWrapper label="Buy or Rent" htmlFor="mw-purpose" className="sm:col-span-2">
          <RadioPillGroup
            name="purpose"
            options={["Rent", "Buy"]}
            value={form.purpose === "sale" ? "Buy" : "Rent"}
            onChange={(v) => update("purpose", v === "Buy" ? "sale" : "rent")}
          />
        </FieldWrapper>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Location</label>
          <p className="rounded border border-line bg-line-soft px-3.5 py-2.5 text-sm text-ink-soft">
            Hat Yai, Thailand — the only area we currently cover
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Preferred Areas</label>
          <div className="flex flex-wrap gap-2">
            {districts.map((district) => (
              <button
                key={district}
                type="button"
                onClick={() => toggleArea(district)}
                aria-pressed={form.preferredAreas.includes(district)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  form.preferredAreas.includes(district)
                    ? "border-matcha-mist bg-matcha-mist text-white"
                    : "border-line text-ink-soft hover:border-matcha-mist"
                }`}
              >
                {district}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">Leave blank for any area.</p>
        </div>

        <FieldWrapper label="Property Type" htmlFor="mw-property-type">
          <Select
            id="mw-property-type"
            value={form.propertyType}
            onChange={(e) => update("propertyType", e.target.value as PropertyType | "Any")}
          >
            <option value="Any">Any type</option>
            {propertyTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Budget" htmlFor="mw-budget">
          <Select id="mw-budget" value={form.budget} onChange={(e) => update("budget", e.target.value)}>
            {budgetOptions.map((b) => (
              <option key={b.label}>{b.label}</option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Bedrooms" htmlFor="mw-bedrooms">
          <Select id="mw-bedrooms" value={form.bedrooms} onChange={(e) => update("bedrooms", e.target.value)}>
            {bedroomOptions.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Bathrooms" htmlFor="mw-bathrooms">
          <Select id="mw-bathrooms" value={form.bathrooms} onChange={(e) => update("bathrooms", e.target.value)}>
            {bathroomOptions.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Minimum Size (sqm)" htmlFor="mw-min-size">
          <TextInput
            id="mw-min-size"
            type="number"
            min={0}
            value={form.minSizeSqm}
            onChange={(e) => update("minSizeSqm", e.target.value)}
            placeholder="e.g. 30"
          />
        </FieldWrapper>

        <FieldWrapper label="Furnished" htmlFor="mw-furnished" className="sm:col-span-2">
          <RadioPillGroup
            name="furnished"
            options={["Fully furnished", "Partially furnished", "Unfurnished", "No preference"]}
            value={form.furnished}
            onChange={(v) => update("furnished", v)}
          />
        </FieldWrapper>

        <FieldWrapper label="Parking" htmlFor="mw-parking" className="sm:col-span-2">
          <RadioPillGroup
            name="parking"
            options={["Required", "Not important"]}
            value={form.parking}
            onChange={(v) => update("parking", v as FormState["parking"])}
          />
        </FieldWrapper>

        <FieldWrapper label="Preferred Move-in Date" htmlFor="mw-movein">
          <TextInput
            id="mw-movein"
            type="date"
            value={form.moveInDate}
            onChange={(e) => update("moveInDate", e.target.value)}
          />
        </FieldWrapper>
      </FormSection>

      <FormSection title="Lifestyle preferences">
        <div className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {supportedLifestyleTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleLifestyle(tag)}
                aria-pressed={form.lifestyle.includes(tag)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  form.lifestyle.includes(tag)
                    ? "border-matcha-mist bg-matcha-mist text-white"
                    : "border-line text-ink-soft hover:border-matcha-mist"
                }`}
              >
                {lifestyleLabels[tag]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">Optional — leave all unselected for no preference.</p>
        </div>
      </FormSection>

      <Button type="submit" size="lg" className="w-full bg-matcha-mist hover:opacity-90 sm:w-auto">
        Find My Matches
      </Button>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line-soft pt-8 first:border-t-0 first:pt-0">
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>
    </div>
  );
}
