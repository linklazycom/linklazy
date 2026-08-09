import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SellerTierBadge } from "@/components/reviews/seller-tier-badge";

interface Filters {
  niche?: string;
  da_min?: string;
  da_max?: string;
  price_max?: string;
  link_type?: string;
  exchange_only?: string;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("buyer_plan, buyer_views_quota, buyer_views_used")
    .eq("id", user!.id)
    .single();

  // Which sites has this buyer already unlocked (so re-viewing doesn't
  // burn another quota slot)?
  const { data: unlocks } = await supabase
    .from("credits_ledger")
    .select("related_site_id")
    .eq("user_id", user!.id)
    .eq("type", "unlock_spend");
  const unlockedIds = new Set((unlocks ?? []).map((u) => u.related_site_id));

  let query = supabase
    .from("sites")
    .select("id, owner_id, domain, niche, da, dr, organic_traffic, price_amount, link_type, accepts_exchange, accepts_paid")
    .eq("status", "approved");

  if (filters.niche) query = query.ilike("niche", `%${filters.niche}%`);
  if (filters.da_min) query = query.gte("da", Number(filters.da_min));
  if (filters.da_max) query = query.lte("da", Number(filters.da_max));
  if (filters.price_max) query = query.lte("price_amount", Number(filters.price_max));
  if (filters.link_type) query = query.eq("link_type", filters.link_type);
  if (filters.exchange_only === "1") query = query.eq("accepts_exchange", true);

  const { data: sites } = await query.order("da", { ascending: false, nullsFirst: false });

  const ownerIds = [...new Set((sites ?? []).map((s) => s.owner_id))];
  const { data: sellerProfiles } = ownerIds.length
    ? await supabase.from("profiles").select("id, seller_tier").in("id", ownerIds)
    : { data: [] };
  const tierByOwner = new Map((sellerProfiles ?? []).map((p) => [p.id, p.seller_tier]));

  const quota = profile?.buyer_views_quota ?? 0;
  const used = profile?.buyer_views_used ?? 0;
  const remaining = Math.max(quota - used, 0);
  const isFree = (profile?.buyer_plan ?? "free") === "free";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Browse sites</h1>
        <MetricChip
          label="Views left"
          value={isFree ? "Upgrade to unlock" : `${remaining}/${quota}`}
          tone={isFree ? "default" : remaining > 0 ? "verified" : "default"}
        />
      </div>

      {isFree && (
        <div className="mb-6 rounded-chip border border-amber/40 bg-amber-soft p-4 text-sm">
          You&apos;re on the Free plan — you can see listing metrics below, but
          need a paid plan to unlock full site details and place orders.{" "}
          <Link href="/dashboard/billing" className="underline">
            View plans
          </Link>
          .
        </div>
      )}

      <form className="mb-6 grid grid-cols-2 gap-4 rounded-chip border border-line bg-white p-4 md:grid-cols-5">
        <Field id="niche" name="niche" label="Niche" defaultValue={filters.niche} />
        <Field id="da_min" name="da_min" type="number" label="DA min" defaultValue={filters.da_min} />
        <Field id="da_max" name="da_max" type="number" label="DA max" defaultValue={filters.da_max} />
        <Field id="price_max" name="price_max" type="number" label="Max price (৳)" defaultValue={filters.price_max} />
        <div>
          <label htmlFor="link_type" className="mb-1 block text-sm text-muted">
            Link type
          </label>
          <select
            id="link_type"
            name="link_type"
            defaultValue={filters.link_type ?? ""}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            <option value="dofollow">Dofollow</option>
            <option value="nofollow">Nofollow</option>
          </select>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm md:col-span-1">
          <input type="checkbox" name="exchange_only" value="1" defaultChecked={filters.exchange_only === "1"} />
          Exchange only
        </label>
        <div className="col-span-2 flex items-end md:col-span-1">
          <Button type="submit" className="w-full">Filter</Button>
        </div>
      </form>

      <div className="space-y-3">
        {sites?.map((site) => {
          const unlocked = unlockedIds.has(site.id);
          return (
            <div key={site.id} className="rounded-chip border border-line bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  {unlocked || !isFree ? site.domain : "Site details locked"}
                  <SellerTierBadge tier={tierByOwner.get(site.owner_id) ?? null} />
                </span>
                {site.accepts_exchange && <MetricChip label="Exchange" value="Available" tone="verified" />}
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <MetricChip label="Niche" value={site.niche} />
                {site.da != null && <MetricChip label="DA" value={site.da} />}
                {site.dr != null && <MetricChip label="DR" value={site.dr} />}
                {site.organic_traffic != null && (
                  <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
                )}
                {site.price_amount != null && (
                  <MetricChip label="Price" value={site.price_amount} tone="price" />
                )}
                <MetricChip label="Type" value={site.link_type} />
              </div>
              <Link href={`/dashboard/browse/${site.id}`}>
                <Button size="sm" variant="secondary">
                  {unlocked ? "View details" : "Unlock & view"}
                </Button>
              </Link>
            </div>
          );
        })}
        {!sites?.length && <p className="text-muted">No sites match these filters.</p>}
      </div>
    </div>
  );
}
