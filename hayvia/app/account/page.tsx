import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import LinkPhonePanel from "@/components/auth/LinkPhonePanel";
import LinkEmailPanel from "@/components/auth/LinkEmailPanel";
import SignOutButton from "@/components/auth/SignOutButton";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Account",
};

export default async function AccountPage() {
  const supabase = createClient();

  // Defense in depth — middleware.ts already redirects unauthenticated
  // visitors away from /account, but this page checks again independently
  // rather than trusting middleware alone (Supabase's own recommendation).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, email_verified, phone_verified, role, created_at")
    .eq("id", user.id)
    .single();

  return (
    <Container className="py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">My Account</h1>
          {profile?.created_at && (
            <p className="mt-1 text-sm text-ink-faint">
              Member since {formatDate(profile.created_at)}
            </p>
          )}
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded border border-line bg-surface p-5">
          <p className="text-sm font-medium text-ink">Profile</p>
          <dl className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink-soft">Name</dt>
              <dd className="text-sm text-ink">{profile?.full_name || "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink-soft">Email</dt>
              <dd className="text-sm text-ink">
                {profile?.email ? (
                  <span className="inline-flex items-center gap-1.5">
                    {profile.email}
                    <VerifiedBadge verified={profile.email_verified} />
                  </span>
                ) : (
                  "Not added"
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-ink-soft">Phone</dt>
              <dd className="text-sm text-ink">
                {profile?.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    {profile.phone}
                    <VerifiedBadge verified={profile.phone_verified} />
                  </span>
                ) : (
                  "Not added"
                )}
              </dd>
            </div>
          </dl>
        </div>

        {(!profile?.phone || !profile?.phone_verified) && <LinkPhonePanel />}
        {(!profile?.email || !profile?.email_verified) && <LinkEmailPanel />}
      </div>
    </Container>
  );
}

function VerifiedBadge({ verified }: { verified?: boolean | null }) {
  if (verified) {
    return (
      <Badge tone="moss">
        <ShieldCheck size={12} /> Verified
      </Badge>
    );
  }
  return (
    <Badge tone="neutral">
      <ShieldAlert size={12} /> Unverified
    </Badge>
  );
}
