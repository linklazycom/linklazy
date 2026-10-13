import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function InquiriesInboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("id, site_id, buyer_id, seller_id, updated_at")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  // Domains come from sites_public: masked for a buyer who hasn't unlocked or
  // ordered the site, real for the seller who owns it.
  const siteIds = Array.from(new Set((inquiries ?? []).map((i) => i.site_id as string)));
  const domainBySite = new Map<string, string>();
  if (siteIds.length > 0) {
    const { data: siteRows } = await supabase.from("sites_public").select("id, domain").in("id", siteIds);
    (siteRows ?? []).forEach((s) => domainBySite.set(s.id as string, s.domain as string));
  }

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">Pre-sale inquiries</h1>
      <p className="mb-6 text-sm text-muted">
        Questions asked before placing an order. Once an order exists, coordination moves to
        that order&apos;s chat instead.
      </p>

      {!inquiries?.length && (
        <p className="text-muted">
          No pre-sale conversations yet — use &quot;Message seller&quot; on any site&apos;s
          detail page to start one.
        </p>
      )}

      <div className="space-y-3">
        {inquiries?.map((inq) => {
          const role = inq.buyer_id === user.id ? "buyer" : "seller";
          const domain = domainBySite.get(inq.site_id as string) ?? "Site";
          return (
            <Link
              key={inq.id}
              href={`/dashboard/inquiries/${inq.id}`}
              className="flex items-center justify-between rounded-chip border border-line bg-white p-4 hover:border-ink"
            >
              <div>
                <span className="font-medium">{domain}</span>
                <span className="ml-2 text-xs capitalize text-muted">({role})</span>
              </div>
              <span className="text-xs text-muted">
                {new Date(inq.updated_at).toLocaleDateString()}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
