import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";

interface SearchFilters {
  niche?: string;
  da_min?: string;
  da_max?: string;
  price_max?: string;
  link_type?: string;
  exchange_only?: string;
}

function siteMatchesFilters(
  site: {
    niche: string;
    da: number | null;
    price_amount: number | null;
    link_type: string;
    accepts_exchange: boolean;
  },
  filters: SearchFilters
): boolean {
  if (filters.niche && !site.niche.toLowerCase().includes(filters.niche.toLowerCase())) return false;
  if (filters.da_min && (site.da ?? 0) < Number(filters.da_min)) return false;
  if (filters.da_max && (site.da ?? 0) > Number(filters.da_max)) return false;
  if (filters.price_max && (site.price_amount ?? Infinity) > Number(filters.price_max)) return false;
  if (filters.link_type && site.link_type !== filters.link_type) return false;
  if (filters.exchange_only === "1" && !site.accepts_exchange) return false;
  return true;
}

/**
 * Runs on a schedule (see vercel.json) — protected by CRON_SECRET so it
 * can't be triggered by anyone who finds the URL.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data: searches } = await supabase
    .from("saved_searches")
    .select("id, user_id, name, filters, email_alerts, last_notified_at")
    .eq("email_alerts", true);

  if (!searches?.length) return NextResponse.json({ checked: 0, notified: 0 });

  let notified = 0;

  for (const search of searches) {
    const since = search.last_notified_at ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const { data: newSites } = await supabase
      .from("sites")
      .select("id, domain, niche, da, price_amount, link_type, accepts_exchange, created_at")
      .eq("status", "approved")
      .gt("created_at", since);

    const matches = (newSites ?? []).filter((s) =>
      siteMatchesFilters(s, search.filters as SearchFilters)
    );

    if (!matches.length) continue;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", search.user_id)
      .single();

    const { data: authUser } = await supabase.auth.admin.getUserById(search.user_id);
    const email = authUser?.user?.email;
    if (!email) continue;

    const listHtml = matches
      .map(
        (m) =>
          `<li><a href="${siteUrl}/dashboard/browse/${m.id}">${m.domain}</a> — ${m.niche}${
            m.da != null ? `, DA ${m.da}` : ""
          }</li>`
      )
      .join("");

    const result = await sendEmail({
      to: email,
      subject: `${matches.length} new site${matches.length > 1 ? "s" : ""} match "${search.name || "your saved search"}"`,
      html: `
        <p>Hi ${profile?.full_name ?? "there"},</p>
        <p>New listings matching your saved search on LinkLazy:</p>
        <ul>${listHtml}</ul>
        <p><a href="${siteUrl}/dashboard/saved-searches">Manage your saved searches</a></p>
      `,
    });

    if (result.ok) {
      notified++;
      await supabase
        .from("saved_searches")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("id", search.id);
    }
  }

  const priceDrops = await checkPriceDrops();

  return NextResponse.json({
    newListingAlerts: { checked: searches.length, notified },
    priceDropAlerts: priceDrops,
  });
}

/**
 * Price-drop alerts, run in the same scheduled invocation: for every
 * watchlist entry with a stored baseline price, check if the site's
 * current price is now lower. If so, email once and reset the baseline
 * to the new (lower) price so the buyer isn't re-notified for the same
 * drop tomorrow — only a further drop from here triggers again.
 */
async function checkPriceDrops() {
  const supabase = createServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data: watched } = await supabase
    .from("watchlists")
    .select("user_id, site_id, price_at_watch, sites(domain, price_amount)")
    .not("price_at_watch", "is", null);

  if (!watched?.length) return { checked: 0, notified: 0 };

  let notified = 0;

  for (const entry of watched) {
    const site = entry.sites as unknown as { domain: string; price_amount: number | null } | null;
    if (!site || site.price_amount == null || entry.price_at_watch == null) continue;
    if (site.price_amount >= entry.price_at_watch) continue;

    const { data: authUser } = await supabase.auth.admin.getUserById(entry.user_id);
    const email = authUser?.user?.email;
    if (!email) continue;

    const result = await sendEmail({
      to: email,
      subject: `Price drop: ${site.domain} is now ৳${site.price_amount}`,
      html: `
        <p>A site on your watchlist dropped in price.</p>
        <p><a href="${siteUrl}/dashboard/watchlist">${site.domain}</a> is now
        ৳${site.price_amount} (was ৳${entry.price_at_watch}).</p>
      `,
    });

    if (result.ok) {
      notified++;
      await supabase
        .from("watchlists")
        .update({ price_at_watch: site.price_amount, last_price_alert_at: new Date().toISOString() })
        .eq("user_id", entry.user_id)
        .eq("site_id", entry.site_id);
    }
  }

  return { checked: watched.length, notified };
}
