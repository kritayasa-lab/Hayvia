import Link from "next/link";
import { Building2, Home, Tag, MessageSquare, CalendarClock, Sparkles, UserPlus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import StatCard from "@/components/admin/StatCard";
import AdminCard from "@/components/admin/AdminCard";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ActivityItem {
  id: string;
  kind: "Inquiry" | "Viewing" | "Seller Lead" | "Matching";
  label: string;
  createdAt: string;
  href: string;
}

async function loadDashboardData() {
  const supabase = createAdminClient();

  const [
    activeProperties,
    forRent,
    forSale,
    newInquiries,
    pendingViewings,
    newMatching,
    newSellerLeads,
    recentInquiries,
    recentViewings,
    recentSellerLeads,
    recentMatching,
  ] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "PUBLISHED"),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "PUBLISHED")
      .eq("listing_type", "RENT"),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "PUBLISHED")
      .eq("listing_type", "BUY"),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "NEW"),
    supabase.from("viewings").select("id", { count: "exact", head: true }).eq("status", "REQUESTED"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "MATCHING")
      .eq("status", "NEW"),
    supabase.from("seller_leads").select("id", { count: "exact", head: true }).eq("status", "NEW"),
    supabase
      .from("inquiries")
      .select("id, name, created_at, properties(title)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("viewings")
      .select("id, customer_name, created_at, properties(title)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("seller_leads")
      .select("id, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("matching_preferences")
      .select("id, purpose, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const activity: ActivityItem[] = [
    ...(recentInquiries.data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      kind: "Inquiry" as const,
      label: `${row.name} inquired about ${
        (row.properties as { title?: string } | null)?.title ?? "a property"
      }`,
      createdAt: row.created_at as string,
      href: "/admin/inquiries",
    })),
    ...(recentViewings.data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      kind: "Viewing" as const,
      label: `${row.customer_name ?? "A customer"} requested a viewing for ${
        (row.properties as { title?: string } | null)?.title ?? "a property"
      }`,
      createdAt: row.created_at as string,
      href: "/admin/viewings",
    })),
    ...(recentSellerLeads.data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      kind: "Seller Lead" as const,
      label: `${row.full_name} submitted a Sell Your Property request`,
      createdAt: row.created_at as string,
      href: "/admin/seller-leads",
    })),
    ...(recentMatching.data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      kind: "Matching" as const,
      label: `New Get Matched request (${row.purpose === "BUY" ? "Buy" : "Rent"})`,
      createdAt: row.created_at as string,
      href: "/admin/matching",
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return {
    activeProperties: activeProperties.count ?? 0,
    forRent: forRent.count ?? 0,
    forSale: forSale.count ?? 0,
    newInquiries: newInquiries.count ?? 0,
    pendingViewings: pendingViewings.count ?? 0,
    newMatching: newMatching.count ?? 0,
    newSellerLeads: newSellerLeads.count ?? 0,
    activity,
  };
}

export default async function AdminDashboardPage() {
  const data = await loadDashboardData();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-faint">
        An overview of Subphiphat Real Estate&apos;s active listings and incoming activity.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Active Properties" value={data.activeProperties} href="/admin/properties" icon={<Building2 size={16} />} />
        <StatCard label="For Rent" value={data.forRent} href="/admin/rent" icon={<Home size={16} />} />
        <StatCard label="For Sale" value={data.forSale} href="/admin/buy" icon={<Tag size={16} />} />
        <StatCard label="New Inquiries" value={data.newInquiries} href="/admin/inquiries" icon={<MessageSquare size={16} />} tone="accent" />
        <StatCard label="Pending Viewings" value={data.pendingViewings} href="/admin/viewings" icon={<CalendarClock size={16} />} tone="accent" />
        <StatCard label="New Matching Requests" value={data.newMatching} href="/admin/matching" icon={<Sparkles size={16} />} tone="accent" />
        <StatCard label="New Seller Leads" value={data.newSellerLeads} href="/admin/seller-leads" icon={<UserPlus size={16} />} tone="accent" />
      </div>

      <div className="mt-8">
        <AdminCard title="Recent Activity">
          {data.activity.length === 0 ? (
            <p className="text-sm text-ink-faint">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {data.activity.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{item.label}</p>
                    <p className="text-xs text-ink-faint">
                      {item.kind} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <Link href={item.href} className="shrink-0 text-xs font-medium text-moss-700 hover:underline">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
