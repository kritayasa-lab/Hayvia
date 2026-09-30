import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ArrowDown, Star, Trash2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOwners, fetchAgents } from "@/lib/admin/people";
import PropertyForm from "@/components/admin/PropertyForm";
import AdminCard from "@/components/admin/AdminCard";
import SaveStatusBanner from "@/components/admin/SaveStatusBanner";
import PropertyImageUpload from "@/components/admin/PropertyImageUpload";
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

  return {
    property,
    images: images ?? [],
    amenities: amenities ?? [],
    selectedAmenityIds: new Set((selected ?? []).map((row) => row.amenity_id as string)),
  };
}

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string; saved?: string; backup?: string };
}) {
  const [{ property, images, amenities, selectedAmenityIds }, owners, agents] = await Promise.all([
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
      <div className="mt-4">
        <SaveStatusBanner justCreated={searchParams.created === "1"} backupStatus={backupStatus} />
      </div>

      {/* Details and Images each get the full page width, stacked, rather
          than sitting side-by-side in a narrow column split — a two-column
          layout let the Images gallery squeeze the Details form into a
          cramped column (and risked horizontal overflow on smaller
          desktop/tablet widths). Stacking is simple, robust, and keeps
          both sections comfortably usable at any viewport. */}
      <div className="mt-6 space-y-6">
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
              flood_status: property.flood_status ?? "UNKNOWN",
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

        <AdminCard title="Images" description="Upload files or add by URL, set the cover, and reorder.">
          <PropertyImageUpload propertyId={property.id} />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image, index) => (
              <li key={image.id} className="group relative overflow-hidden rounded-lg border border-line-soft">
                <div className="relative aspect-[4/3] w-full bg-line-soft/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="h-full w-full object-cover" />

                  {image.is_cover && (
                    <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-moss-600 px-2.5 py-1 text-xs font-semibold text-white shadow">
                      <Star size={12} className="fill-current" /> Cover
                    </span>
                  )}

                  {/*
                    Action layer: on desktop (sm:+) it is hidden until the
                    card is hovered or focused, per the "hover to reveal
                    an explicit Set as Cover action" requirement. Below
                    that breakpoint there is no hover, so it is visible by
                    default -- the touch/mobile case gets the same "Set as
                    Cover" button directly in the card's action area.
                  */}
                  <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-black/10 to-transparent p-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <div className="flex items-center justify-end gap-1">
                      <form action={moveImage.bind(null, property.id, image.id, "up")}>
                        <button
                          type="submit"
                          disabled={index === 0}
                          className="rounded bg-white/90 p-1.5 text-ink-soft shadow hover:bg-white disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ArrowUp size={14} />
                        </button>
                      </form>
                      <form action={moveImage.bind(null, property.id, image.id, "down")}>
                        <button
                          type="submit"
                          disabled={index === images.length - 1}
                          className="rounded bg-white/90 p-1.5 text-ink-soft shadow hover:bg-white disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </form>
                      <form action={removePropertyImage.bind(null, image.id, property.id)}>
                        <button
                          type="submit"
                          className="rounded bg-white/90 p-1.5 text-red-500 shadow hover:bg-white"
                          aria-label="Remove image"
                        >
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>

                    <div>
                      {image.is_cover ? (
                        <span className="inline-flex items-center gap-1 rounded bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-moss-700 shadow">
                          <Star size={12} className="fill-current" /> Cover
                        </span>
                      ) : (
                        <form action={setCoverImage.bind(null, image.id, property.id)}>
                          <button
                            type="submit"
                            className="rounded bg-white px-2.5 py-1.5 text-xs font-semibold text-ink shadow hover:bg-moss-50"
                          >
                            Set as Cover
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
                <p className="truncate px-2 py-1.5 text-[11px] text-ink-faint">{image.url}</p>
              </li>
            ))}
          </ul>
          {images.length === 0 && <p className="text-sm text-ink-faint">No images yet.</p>}

          <p className="mt-3 text-xs font-medium text-ink-soft">Or add by URL</p>
          <form action={addPropertyImage.bind(null, property.id)} className="mt-1.5 flex gap-2">
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
  );
}
