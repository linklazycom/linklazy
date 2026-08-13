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
 * Runs every Friday (see vercel.json) — protected by CRON_SECRET.
 * Sends one weekly summary per user who has at least one saved search
 * with email_alerts on: their own matches from the past 7 days, plus a
 * fallback "top new listings this week" list if they had no personal
 * matches. This is separate from the daily real-time search-alerts cron.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: newSites } = await supabase
    .from("sites")
    .select("id, domain, niche, da, price_amount, link_type, accepts_exchange, organic_traffic, created_at")
    .eq("status", "approved")
    .gt("created_at", since.toISOString());

  const topOverall = [...(newSites ?? [])]
    .sort((a, b) => (b.organic_traffic ?? 0) - (a.organic_traffic ?? 0))
    .slice(0, 5);

  const { data: searches } = await supabase
    .from("saved_searches")
    .select("user_id, name, filters")
    .eq("email_alerts", true);

  if (!searches?.length) return NextResponse.json({ sent: 0 });

  // One email per user, even if they have multiple saved searches.
  const byUser = new Map<string, { names: string[]; filtersList: SearchFilters[] }>();
  for (const s of searches) {
    const entry = byUser.get(s.user_id) ?? { names: [], filtersList: [] };
    entry.names.push(s.name || "Saved search");
    entry.filtersList.push(s.filters as SearchFilters);
    byUser.set(s.user_id, entry);
  }

  let sent = 0;

  for (const [userId, { filtersList }] of byUser) {
    const personalMatches = (newSites ?? []).filter((s) =>
      filtersList.some((f) => siteMatchesFilters(s, f))
    );

    const listToSend = personalMatches.length ? personalMatches.slice(0, 8) : topOverall;
    if (!listToSend.length) continue;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (!email) continue;

    const listHtml = listToSend
      .map(
        (s) =>
          `<li><a href="${siteUrl}/dashboard/browse/${s.id}">${s.domain}</a> — ${s.niche}${
            s.da != null ? `, DA ${s.da}` : ""
          }</li>`
      )
      .join("");

    const heading = personalMatches.length
      ? "New listings matching your saved searches this week:"
      : "No new matches for your saved searches this week — here's what's trending instead:";

    const result = await sendEmail({
      to: email,
      subject: personalMatches.length
        ? `${personalMatches.length} new match${personalMatches.length > 1 ? "es" : ""} this week on LinkLazy`
        : "This week on LinkLazy",
      html: `
        <p>Hi ${profile?.full_name ?? "there"},</p>
        <p>${heading}</p>
        <ul>${listHtml}</ul>
        <p><a href="${siteUrl}/dashboard/saved-searches">Manage your saved searches</a></p>
        <p style="color:#6B7280;font-size:12px;margin-top:16px;">
          You're getting this because you have an active saved search with
          email alerts on. Turn it off anytime from the link above.
        </p>
      `,
    });

    if (result.ok) sent++;
  }

  return NextResponse.json({ usersChecked: byUser.size, sent });
}
