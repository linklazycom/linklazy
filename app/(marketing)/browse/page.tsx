import Link from "next/link";
import type { Metadata } from "next";
import { SlidersHorizontal, ShieldCheck, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SiteCard } from "@/components/sites/site-card";
import { Pagination } from "@/components/ui/pagination";
import { AdSlot } from "@/components/ads/ad-slot";
import { NICHES } from "@/lib/niches";
import { maskDomain } from "@/lib/mask-domain";
import { getSellerRatings } from "@/lib/seller-ratings";
import { getUnlockedSiteIds } from "@/lib/unlocked-sites";

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: "Browse Sites",
  description: "Browse verified sites available for backlink exchange or paid placement, with transparent metrics.",
};

interface Filters {
  niche?: string;
  da_min?: string;
  da_max?: string;
  price_max?: string;
  link_type?: string;
  exchange_only?: string;
  page?: string;
  [key: string]: string | undefined;
}

export default async function PublicBrowsePage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let unlockedIds = new Set<string>();

  if (user) {
    unlockedIds = await getUnlockedSiteIds(supabase, user.id);
  }

  let query = supabase
    .from("sites")
    .select(
      "id, owner_id, domain, niche, da, dr, dr_verified, organic_traffic, price_amount, link_type, accepts_exchange, accepts_paid, pay_per_view_enabled, view_price, is_featured, created_at",
      { count: "exact" }
    )
    .eq("status", "approved");

  if (filters.niche) query = query.eq("niche", filters.niche);
  if (filters.da_min) query = query.gte("da", Number(filters.da_min));
  if (filters.da_max) query = query.lte("da", Number(filters.da_max));
  if (filters.price_max) query = query.lte("price_amount", Number(filters.price_max));
  if (filters.link_type) query = query.eq("link_type", filters.link_type);
  if (filters.exchange_only === "1") query = query.eq("accepts_exchange", true);

  const currentPage = Math.max(1, Number(filters.page) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: sites, count: totalCount } = await query
    .order("is_featured", { ascending: false })
    .order("da", { ascending: false, nullsFirst: false })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  const ownerIds = [...new Set((sites ?? []).map((s) => s.owner_id))];
  const { data: sellerProfiles } = ownerIds.length
    ? await supabase.from("profiles").select("id, display_name, seller_tier").in("id", ownerIds)
    : { data: [] };
  const tierByOwner = new Map((sellerProfiles ?? []).map((p) => [p.id, p.seller_tier]));
  const nameByOwner = new Map((sellerProfiles ?? []).map((p) => [p.id, p.display_name]));
  const ratingByOwner = await getSellerRatings(supabase, ownerIds);

  return (
    <main className="relative">
      {/* Soft brand-gradient wash behind the header, matching the homepage's
          visual language without repeating its full hero treatment. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 overflow-hidden">
        <div
          className="absolute -top-24 left-1/4 h-[320px] w-[320px] rounded-full opacity-[0.10] blur-3xl"
          style={{ background: "#2C75FC" }}
        />
        <div
          className="absolute -top-16 right-1/4 h-[280px] w-[280px] rounded-full opacity-[0.10] blur-3xl"
          style={{ background: "#B23CFC" }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <AdSlot placement="browse_top" />

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand-violet/20 bg-brand-soft px-3 py-1 font-mono text-xs uppercase tracking-widest text-brand-violet">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified listings
            </p>
            <h1 className="font-display text-3xl font-medium tracking-tight">Browse sites</h1>
            <p className="mt-1.5 max-w-md text-sm text-muted">
              Metrics are visible to everyone. Unlock a listing to see the
              site and place an order.
            </p>
          </div>
          {!user && (
            <Link href="/register">
              <Button size="sm">Log in to unlock</Button>
            </Link>
          )}
        </div>

        <form className="relative mb-8 grid grid-cols-2 gap-4 overflow-hidden rounded-chip border border-line bg-white p-5 shadow-sm md:grid-cols-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
          <div className="col-span-2 mb-1 flex items-center gap-1.5 text-xs font-medium text-muted md:col-span-5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter listings
          </div>
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
              className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
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

        {totalCount != null && totalCount > 0 && (
          <p className="mb-4 text-sm text-muted">
            {totalCount} {totalCount === 1 ? "site matches" : "sites match"} your filters
            {totalPages > 1 && ` — page ${currentPage} of ${totalPages}`}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites?.map((site) => {
            const unlocked = unlockedIds.has(site.id);
            return (
              <SiteCard
                key={site.id}
                site={site}
                href={`/browse/${site.id}`}
                sellerTier={tierByOwner.get(site.owner_id) ?? null}
                sellerName={nameByOwner.get(site.owner_id)}
                sellerRating={ratingByOwner.get(site.owner_id) ?? null}
                sellerHref={`/profile/${site.owner_id}`}
                displayDomain={unlocked ? site.domain : maskDomain(site.domain)}
                ctaLabel={unlocked ? "View details" : "View Site"}
              />
            );
          })}
        </div>

        <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/browse" params={filters} />

        {!sites?.length && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-chip border border-dashed border-line bg-paper px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
              <SearchX className="h-6 w-6 text-muted" />
            </div>
            <div>
              <p className="font-display text-base font-medium text-ink">No sites match these filters</p>
              <p className="mt-1 text-sm text-muted">Try widening your DA range or clearing the niche filter.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
