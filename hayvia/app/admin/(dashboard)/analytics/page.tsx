import { createAdminClient } from "@/lib/supabase/admin";
import AdminCard from "@/components/admin/AdminCard";
import StatCard from "@/components/admin/StatCard";
import { Eye, Building2, MessageSquare, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

async function loadAnalytics() {
  const supabase = createAdminClient();

  const [
    { count: totalProperties },
    { count: totalInquiries },
    { count: totalViewings },
    { data: properties },
    { data: inquiries },
    { data: viewings },
  ] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("inquiries").select("id", { count: "exact", head: true }),
    supabase.from("viewings").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("title, view_count").order("view_count", { ascending: false }).limit(5),
    supabase.from("inquiries").select("status"),
    supabase.from("viewings").select("status"),
  ]);

  const totalViews = (properties ?? []).reduce((sum, p) => sum + (p.view_count ?? 0), 0);

  function countByStatus(rows: { status: string }[] | null) {
    const counts: Record<string, number> = {};
    for (const row of rows ?? []) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return counts;
  }

  return {
    totalProperties: totalProperties ?? 0,
    totalInquiries: totalInquiries ?? 0,
    totalViewings: totalViewings ?? 0,
    totalViews,
    topProperties: properties ?? [],
    inquiryStatusCounts: countByStatus(inquiries),
    viewingStatusCounts: countByStatus(viewings),
  };
}

function StatusBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  const entries = Object.entries(counts);
  if (entries.length === 0 || total === 0) {
    return <p className="text-sm text-ink-faint">No data yet.</p>;
  }
  return (
    <div className="space-y-2">
      {entries.map(([status, count]) => (
        <div key={status}>
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>{status.replace(/_/g, " ")}</span>
            <span>{count}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-line-soft">
            <div
              className="h-1.5 rounded-full bg-moss-500"
              style={{ width: `${Math.round((count / total) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const data = await loadAnalytics();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Analytics</h1>
      <p className="mt-1 text-sm text-ink-faint">Real activity from Supabase — no estimated or placeholder figures.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Properties" value={data.totalProperties} icon={Building2} />
        <StatCard label="Total Property Views" value={data.totalViews} icon={Eye} />
        <StatCard label="Total Inquiries" value={data.totalInquiries} icon={MessageSquare} />
        <StatCard label="Total Viewing Requests" value={data.totalViewings} icon={CalendarClock} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminCard title="Most Viewed Properties">
          {data.topProperties.length === 0 ? (
            <p className="text-sm text-ink-faint">No properties yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {data.topProperties.map((p, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="truncate text-ink-soft">
                    {i + 1}. {p.title}
                  </span>
                  <span className="shrink-0 font-medium text-ink">{p.view_count}</span>
                </li>
              ))}
            </ol>
          )}
        </AdminCard>

        <AdminCard title="Inquiries by Status">
          <StatusBar counts={data.inquiryStatusCounts} total={data.totalInquiries} />
        </AdminCard>

        <AdminCard title="Viewings by Status">
          <StatusBar counts={data.viewingStatusCounts} total={data.totalViewings} />
        </AdminCard>
      </div>
    </div>
  );
}
