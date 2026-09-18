import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import SignOutButton from "@/components/auth/SignOutButton";
import { requireCustomerAccount } from "@/lib/customers/account";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Account",
};

// Server-side authentication/authorization check happens inside
// requireCustomerAccount() (lib/customers/account.ts) — this is the
// defense-in-depth layer that runs regardless of middleware, matching the
// existing requireAdmin() pattern for /admin/*. Every row below only ever
// comes from a query scoped by the Phase 5 RLS policies to the signed-in
// customer's own customer_id — never a wider read narrowed by UI alone.
export const dynamic = "force-dynamic";

const inquiryTypeLabel: Record<string, string> = {
  ENQUIRE: "Enquiry",
  CONTACT: "Contact request",
};

export default async function AccountPage({ searchParams }: { searchParams: { welcome?: string } }) {
  const { account, inquiries, viewings, matching } = await requireCustomerAccount();

  return (
    <Container className="py-10 sm:py-14">
      {(searchParams.welcome === "new" || searchParams.welcome === "back") && (
        <div className="mx-auto mb-8 max-w-2xl rounded border border-moss-100 bg-moss-50 p-5 text-center">
          {searchParams.welcome === "new" ? (
            <>
              <p className="font-display text-lg text-ink">Your account has been created 🎉</p>
              <p className="mt-1 text-sm text-ink-soft">Welcome to Subphiphat Real Estate.</p>
            </>
          ) : (
            <>
              <p className="font-display text-lg text-ink">Welcome back 👋</p>
              <p className="mt-1 text-sm text-ink-soft">
                You&apos;re signed in as <span className="font-medium text-ink">{account.email}</span>
              </p>
            </>
          )}
        </div>
      )}

      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-ink">{account.fullName || "My Account"}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {account.email}
              {account.emailVerified && (
                <Badge tone="moss" className="ml-2">
                  Verified
                </Badge>
              )}
            </p>
          </div>
          <SignOutButton />
        </div>

        <section className="mt-10">
          <h2 className="font-display text-lg text-ink">Inquiries</h2>
          {inquiries.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">No inquiries yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft rounded border border-line">
              {inquiries.map((row) => (
                <li key={row.id} className="p-4">
                  <p className="text-sm text-ink">
                    {inquiryTypeLabel[row.inquiryType] ?? row.inquiryType} ·{" "}
                    {row.property ? (
                      <Link href={`/properties/${row.property.slug}`} className="text-moss-700 hover:underline">
                        {row.property.title}
                      </Link>
                    ) : (
                      "Property no longer available"
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    <Badge tone="neutral">{row.status}</Badge> · {formatDate(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg text-ink">Viewing Requests</h2>
          {viewings.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">No viewing requests yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft rounded border border-line">
              {viewings.map((row) => (
                <li key={row.id} className="p-4">
                  <p className="text-sm text-ink">
                    {row.viewingType === "VIDEO_CALL" ? "Video Call" : "In-person"} ·{" "}
                    {row.property ? (
                      <Link href={`/properties/${row.property.slug}`} className="text-moss-700 hover:underline">
                        {row.property.title}
                      </Link>
                    ) : (
                      "Property no longer available"
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    <Badge tone="neutral">{row.status}</Badge>
                    {row.preferredDate && ` · ${formatDate(row.preferredDate)}`} · {formatDate(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg text-ink">Matching Requests</h2>
          {matching.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">No matching requests yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft rounded border border-line">
              {matching.map((row) => (
                <li key={row.id} className="p-4">
                  <p className="text-sm text-ink">
                    {row.purpose === "BUY" ? "Buy" : "Rent"} · {row.location}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">{formatDate(row.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Container>
  );
}
