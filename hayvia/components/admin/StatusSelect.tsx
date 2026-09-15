"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/FormField";

/**
 * A status dropdown that PATCHes /api/admin/<entity>/<id> with the new value
 * on change, then refreshes the current route so the rest of the page (e.g.
 * dashboard counts on another page) reflects it next visit. Used identically
 * across Inquiries/Viewings/Seller Leads/Leads — the only thing that differs
 * per table is which status enum values are valid, passed in as `options`.
 */
export default function StatusSelect({
  entity,
  id,
  value,
  options,
}: {
  entity: string;
  id: string;
  value: string;
  options: string[];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: string) {
    const previous = current;
    setCurrent(next);
    setError(null);

    try {
      const response = await fetch(`/api/admin/${entity}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to update status.");
      }
      startTransition(() => router.refresh());
    } catch {
      setCurrent(previous);
      setError("Failed to update. Please try again.");
    }
  }

  return (
    <div>
      <Select
        value={current}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="!py-1.5 !text-xs"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </Select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
