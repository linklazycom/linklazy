import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DomainManager, type DomainView } from "@/components/domains/domain-manager";
import { isLinkFeatureOn, getLinkLimits } from "@/lib/links/server";
import { connectionMode, DOMAIN_COLUMNS } from "@/lib/domains/service";
import { isApexLike, relativeDnsName, txtRecordName, txtRecordValue } from "@/lib/domains/hostname";
import { VERCEL_A_RECORD, VERCEL_CNAME_TARGET } from "@/lib/domains/dns";

export const metadata = { title: "Custom domains" };

export default async function DomainsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (!(await isLinkFeatureOn())) {
    return (
      <div>
        <h1 className="mb-2 font-display text-2xl font-medium">Custom domains</h1>
        <p className="text-muted">Link management is temporarily turned off. Please check back soon.</p>
      </div>
    );
  }

  const [{ data: rows }, limits, { data: profile }] = await Promise.all([
    supabase.from("custom_domains").select(DOMAIN_COLUMNS).eq("user_id", user.id).order("created_at", { ascending: false }),
    getLinkLimits(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  const isAdmin = profile?.role === "admin";
  const list = rows ?? [];
  const max = limits.domain_max_per_user;

  const domains: DomainView[] = list.map((r) => {
    const apex = isApexLike(r.hostname);
    return {
      id: r.id,
      hostname: r.hostname,
      status: r.status as DomainView["status"],
      root_redirect_url: r.root_redirect_url,
      last_error: r.last_error,
      last_checked_at: r.last_checked_at,
      disabled_note: null,
      txtName: txtRecordName(r.hostname),
      txtValue: txtRecordValue(r.verify_token),
      routeType: apex ? "A" : "CNAME",
      routeName: apex ? "@" : relativeDnsName(r.hostname, r.hostname),
      routeValue: apex ? VERCEL_A_RECORD : VERCEL_CNAME_TARGET,
    };
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">Custom domains</h1>
        <p className="text-sm text-muted">
          Use your own domain for short links, for example <code className="font-mono">go.yourbrand.com/sale</code>.{" "}
          {isAdmin ? `${list.length} domains` : `${list.length} of ${max} domains used`}.{" "}
          <Link href="/dashboard/links" className="underline">
            Back to short links
          </Link>
        </p>
      </div>
      {max === 0 && !isAdmin ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">Custom domains are not available right now.</p>
      ) : (
        <DomainManager domains={domains} mode={connectionMode()} canAdd={isAdmin || list.length < max} />
      )}
      <p className="text-xs text-muted">
        Only redirects are served on your domain — nothing else from LinkLazy. Your links keep working on linklazy.com too. Click statistics include visits from both.
      </p>
    </div>
  );
}
