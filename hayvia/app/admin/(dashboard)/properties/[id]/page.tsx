import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ArrowDown, Star, Trash2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOwners, fetchAgents } from "@/lib/admin/people";
import PropertyForm from "@/components/admin/PropertyForm";
import AdminCard from "@/components/admin/AdminCard";
import SaveStatusBanner from "@/components/admin/SaveStatusBanner";
import {
  updateProperty,
  addPropertyImage,
  removePropertyImage,
  setCoverImage,
  moveImage,
  toggleAmenity,
} from "@/app/admin/(dashboard)/properties/actions";

export const dynamic = "force-dynamic";

async function loadProperty(id: string) {
  const supabase = createAdminClient();

  const [{ data: property }, { data: images }, { data: amenities }, { data: selected }] =
    await Promise.all([
      supabase.from("properties").select("*").eq("id", id).single(),
      supabase
        .from("property_images")
        .select("id, url, sort_order, is_cover")
        .eq("property_id", id)
        .order("sort_order", { ascending: true }),
      supabase.from("amenities").select("id, name").order("name", { ascending: true }),
      supabase.from("property_amenities").select("amenity_id").eq("property_id", id),
    ]);

  // Phase 8C — reverse traceability to the Property Radar candidate this
  // property was converted from, if any. Same best-effort caveat as
  // seller_lead_id: not every property has one.
  let radarCandidate: { id: string; candidate_code: string } | null = null;
  if (property?.radar_property_candidate_id) {
    const { data } = await supabase
      .from("radar_property_candidates")
      .select("id, candidate_code")
      .eq("id", property.radar_property_candidate_id)
      .maybeSingle();
    radarCandidate = data;
  }

  return {
    property,
    images: images ?? [],
    amenities: amenities ?? [],
    selectedAmenityIds: new Set((selected ?? []).map((row) => row.amenity_id as string)),
    radarCandidate,
  };
}

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string; saved?: string; backup?: string };
}) {
  const [{ property, images, amenities, selectedAmenityIds, radarCandidate }, owners, agents] = await Promise.all([
    loadProperty(params.id),
    fetchOwners(),
    fetchAgents(),
  ]);

  if (!property) notFound();

  const backupStatus =
    searchParams.backup === "success" || searchParams.backup === "pending" ? searchParams.backup : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl text-ink">{property.title}</h1>
        <span className="rounded bg-moss-50 px-2 py-0.5 font-mono text-sm font-medium text-moss-700">
          {property.property_code}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-faint">Database ID: {property.id}</p>
      {property.seller_lead_id && (
        <Link
          href={`/admin/seller-leads/${property.seller_lead_id}`}
          className="mt-1 inline-block text-sm font-medium text-moss-700 hover:underline"
        >
          Created from Seller Lead &rarr; View Seller Lead
        </Link>
      )}
      {radarCandidate && (
        <Link
          href={`/admin/radar/properties/${radarCandidate.id}`}
          className="mt-1 inline-block text-sm font-medium text-moss-700 hover:underline"
        >
          Discovered via Radar &rarr; {radarCandidate.candidate_code}
        </Link>
      )}

      <div className="mt-4">
        <SaveStatusBanner justCreated={searchParams.created === "1"} backupStatus={backupStatus} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <AdminCard title="Details">
          <PropertyForm
            action={updateProperty.bind(null, property.id)}
            initial={{
              listing_type: property.listing_type,
              status: property.status,
              title: property.title,
              slug: property.slug,
              property_type: property.property_type,
              description: property.description ?? "",
              price: property.price,
              currency: property.currency,
              rental_period: property.rental_period,
              bedrooms: property.bedrooms ?? "",
              bathrooms: property.bathrooms ?? "",
              size_sqm: property.size_sqm ?? "",
              furnished: property.furnished,
              parking: property.parking,
              wifi: property.wifi,
              available_date: property.available_date ?? "",
              minimum_rental: property.minimum_rental ?? "",
              deposit: property.deposit ?? "",
              country: property.country,
              province: property.province,
              city: property.city,
              district: property.district ?? "",
              subdistrict: property.subdistrict ?? "",
              google_maps_url: property.google_maps_url ?? "",
              verified: property.verified,
              featured: property.featured,
              price_reduced: property.price_reduced,
              owner_id: property.owner_id ?? "",
              agent_id: property.agent_id ?? "",
              source: property.source ?? "",
              source_url: property.source_url ?? "",
              commission_type: property.commission_type,
              commission_value: property.commission_value ?? "",
              private_notes: property.private_notes ?? "",
            }}
            owners={owners}
            agents={agents}
            submitLabel="Save Changes"
          />
        </AdminCard>

        <div className="space-y-6">
          <AdminCard title="Images" description="Add by URL, set the cover, and reorder.">
            <ul className="space-y-2">
              {images.map((image, index) => (
                <li
                  key={image.id}
                  className="flex items-center gap-3 rounded border border-line-soft p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt=""
                    className="h-12 w-16 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-ink-soft">{image.url}</p>
                    {image.is_cover && (
                      <span className="text-xs font-medium text-moss-700">Cover image</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <form action={moveImage.bind(null, property.id, image.id, "up")}>
                      <button
                        type="submit"
                        disabled={index === 0}
                        className="rounded p-1.5 text-ink-faint hover:bg-line-soft disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                    </form>
                    <form action={moveImage.bind(null, property.id, image.id, "down")}>
                      <button
                        type="submit"
                        disabled={index === images.length - 1}
                        className="rounded p-1.5 text-ink-faint hover:bg-line-soft disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </form>
                    {!image.is_cover && (
                      <form action={setCoverImage.bind(null, image.id, property.id)}>
                        <button
                          type="submit"
                          className="rounded p-1.5 text-ink-faint hover:bg-line-soft"
                          aria-label="Set as cover"
                        >
                          <Star size={14} />
                        </button>
                      </form>
                    )}
                    <form action={removePropertyImage.bind(null, image.id, property.id)}>
                      <button
                        type="submit"
                        className="rounded p-1.5 text-red-400 hover:bg-red-50"
                        aria-label="Remove image"
                      >
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </li>
              ))}
              {images.length === 0 && (
                <p className="text-sm text-ink-faint">No images yet.</p>
              )}
            </ul>

            <form action={addPropertyImage.bind(null, property.id)} className="mt-3 flex gap-2">
              <input
                type="url"
                name="url"
                required
                placeholder="https://..."
                className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/30"
              />
              <button
                type="submit"
                className="shrink-0 rounded bg-moss-600 px-3 py-2 text-sm font-medium text-white hover:bg-moss-700"
              >
                Add
              </button>
            </form>
          </AdminCard>

          <AdminCard title="Amenities">
            <div className="flex flex-wrap gap-2">
              {amenities.map((amenity) => {
                const active = selectedAmenityIds.has(amenity.id);
                return (
                  <form
                    key={amenity.id}
                    action={toggleAmenity.bind(null, property.id, amenity.id, !active)}
                  >
                    <button
                      type="submit"
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-moss-600 bg-moss-600 text-white"
                          : "border-line text-ink-soft hover:border-moss-400"
                      }`}
                    >
                      {amenity.name}
                    </button>
                  </form>
                );
              })}
              {amenities.length === 0 && (
                <p className="text-sm text-ink-faint">No amenities defined yet.</p>
              )}
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
