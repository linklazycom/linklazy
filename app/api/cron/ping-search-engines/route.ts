import { trackCron } from "@/lib/cron-track";
import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron-auth";

/**
 * Pings search engines to re-fetch the sitemap. Doesn't guarantee faster
 * indexing, but signals "something changed, come look" instead of waiting
 * for the next scheduled crawl.
 *
 * Note: Google retired its public sitemap ping endpoint in 2023 — this now
 * relies on Google Search Console's own crawl schedule, which reads the
 * sitemap URL declared in robots.txt automatically. Bing's ping endpoint
 * is still active as of writing and is included here.
 */
async function handle(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com";
  const sitemapUrl = `${siteUrl}/sitemap.xml`;

  const results: Record<string, string> = {};

  try {
    const bingRes = await fetch(
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
    );
    results.bing = bingRes.ok ? "pinged" : `failed (${bingRes.status})`;
  } catch (e) {
    results.bing = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  results.google =
    "skipped — Google retired the public sitemap ping endpoint in 2023; submit the sitemap once in Google Search Console instead (see notes below)";

  return NextResponse.json({ sitemapUrl, results });
}

export async function GET(request: Request) {
  return trackCron("ping-search-engines", () => handle(request));
}
