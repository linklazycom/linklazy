import { createClient } from "@/lib/supabase/server";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SaveSearchButton } from "@/components/watchlist/save-search-button";
import { BulkOrderSelector } from "@/components/sites/bulk-order-selector";
import { AdSlot } from "@/components/ads/ad-slot";
import { NICHES } from "@/lib/niches";
import { getSellerRatings } from "@/lib/seller-ratings";
import { getUnlockedSiteIds } from "@/lib/unlocked-sites";

interface Filters {
  niche?: string;
  da_min?: string;
  da_max?: string;
  price_max?: string;
  link_type?: string;
  exchange_only?: string;
  [key: string]: string | undefined;
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

  const unlockedIds = await getUnlockedSiteIds(supabase, user!.id);

  let query = supabase
    .from("sites")
    .select("id, owner_id, domain, niche, da, dr, dr_verified, organic_traffic, price_amount, link_type, accepts_exchange, accepts_paid, is_featured, created_at")
    .eq("status", "approved");

  if (filters.niche) query = query.eq("niche", filters.niche);
  if (filters.da_min) query = query.gte("da", Number(filters.da_min));
  if (filters.da_max) query = query.lte("da", Number(filters.da_max));
  if (filters.price_max) query = query.lte("price_amount", Number(filters.price_max));
  if (filters.link_type) query = query.eq("link_type", filters.link_type);
  if (filters.exchange_only === "1") query = query.eq("accepts_exchange", true);

  const { data: sites } = await query
    .order("is_featured", { ascending: false })
    .order("da", { ascending: false, nullsFirst: false });

  const ownerIds = [...new Set((sites ?? []).map((s) => s.owner_id))];
  const { data: sellerProfiles } = ownerIds.length
    ? await supabase.from("profiles").select("id, display_name, seller_tier").in("id", ownerIds)
    : { data: [] };
  const tierByOwner = new Map((sellerProfiles ?? []).map((p) => [p.id, p.seller_tier]));
  const nameByOwner = new Map((sellerProfiles ?? []).map((p) => [p.id, p.display_name]));
  const ratingByOwner = await getSellerRatings(supabase, ownerIds);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Browse sites</h1>
      </div>

      <AdSlot placement="browse_top" />

      <form className="mb-6 grid grid-cols-2 gap-4 rounded-chip border border-line bg-white p-4 md:grid-cols-5">
        <div>
          <label htmlFor="niche" className="mb-1 block text-sm text-muted">
            Niche
          </label>
          <select
            id="niche"
            name="niche"
            defaultValue={filters.niche ?? ""}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          >
            <option value="">Any niche</option>
            {NICHES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
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
        <div className="col-span-2 flex items-end gap-2 md:col-span-1">
          <Button type="submit" className="w-full">Filter</Button>
        </div>
      </form>

      <div className="mb-6 flex justify-end">
        <SaveSearchButton filters={filters} />
      </div>

      <BulkOrderSelector
        sites={sites ?? []}
        tierByOwner={tierByOwner}
        nameByOwner={nameByOwner}
        ratingByOwner={ratingByOwner}
        currentUserId={user!.id}
        unlockedIds={unlockedIds}
      />
    </div>
  );
}
