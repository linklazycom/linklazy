import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pickUserHelpKey, userHelpForPath, USER_HELP, USER_HELP_AREAS } from "@/lib/help/user-help";
import { toolById, toolForPath, TOOLS } from "@/lib/features/registry";

const read = (f: string) => readFileSync(f, "utf8");

test("user help: every entry is filled, has a known section and points at a real dashboard page", () => {
  for (const [key, e] of Object.entries(USER_HELP)) {
    assert.ok(e.title && e.what && e.why && e.how.length >= 1, key);
    assert.ok((USER_HELP_AREAS as readonly string[]).includes(e.area), `${key}: unknown section ${e.area}`);
    assert.ok(key.startsWith("/dashboard"), key);
    assert.ok(existsSync(`app/(dashboard)${key}/page.tsx`), `${key} has no page`);
  }
});

test("user help: the most specific entry wins; [id] keys work; the Overview matches only itself", () => {
  assert.equal(pickUserHelpKey("/dashboard"), "/dashboard");
  assert.equal(pickUserHelpKey("/dashboard/unknown-page"), null, "an unknown page is not given the Overview text");
  assert.equal(pickUserHelpKey("/dashboard/sites"), "/dashboard/sites");
  assert.equal(pickUserHelpKey("/dashboard/sites/abc/matches"), "/dashboard/sites/[id]/matches");
  assert.equal(pickUserHelpKey("/dashboard/sites/abc/verify"), "/dashboard/sites/[id]/verify");
  assert.equal(pickUserHelpKey("/dashboard/sites/abc/slots"), "/dashboard/sites/[id]/slots");
  assert.equal(pickUserHelpKey("/dashboard/matches/7d1c"), "/dashboard/matches/[id]");
  assert.equal(pickUserHelpKey("/dashboard/browse/bulk-order"), "/dashboard/browse/bulk-order");
  assert.equal(pickUserHelpKey("/dashboard/browse/abc"), "/dashboard/browse/[id]");
  assert.equal(pickUserHelpKey("/dashboard/links/abc/analytics"), "/dashboard/links", "inner pages fall back to their tool's text");
  assert.equal(pickUserHelpKey("/dashboard/projects/new"), "/dashboard/projects");
  assert.equal(pickUserHelpKey("/dashboardx"), null, "look-alike path");
  assert.equal(userHelpForPath("/dashboard/wallet")?.entry.title, "Wallet");
});

test("user help: every page in the dashboard menu has a help text", () => {
  const layout = read("app/(dashboard)/layout.tsx");
  const hrefs = [...layout.matchAll(/href: "(\/dashboard[^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 25, "found the menu links");
  const missing = hrefs.filter((h) => !userHelpForPath(h));
  assert.deepEqual(missing, [], `no help text for: ${missing.join(", ")}`);
});

test("user help: every inner page of every switchable tool has a text too", () => {
  for (const t of TOOLS.filter((x) => x.surface !== "public")) {
    for (const prefix of t.pagePrefixes) assert.ok(userHelpForPath(prefix), `${t.id}: ${prefix}`);
  }
  for (const p of ["/dashboard/sites/x/matches", "/dashboard/matches/x", "/dashboard/scan-site/history", "/dashboard/backlinks/import", "/dashboard/bio/x", "/dashboard/orders/x", "/dashboard/inquiries/x", "/dashboard/support/x", "/dashboard/messages/x"]) {
    assert.ok(userHelpForPath(p), p);
  }
});

test("user help: texts promise nothing they cannot keep", () => {
  const all = JSON.stringify(USER_HELP);
  assert.ok(!/\b(guarantee|guaranteed|best|#1)\b/i.test(all.replace(/not a promise/gi, "")), "no guarantees or superlatives");
  assert.ok(!/\b\d{2,}\s?(%|\+|k\b)/.test(all), "no made-up statistics");
});

test("the help button is mounted in the dashboard and the public Help page lists only tools that are on", () => {
  assert.ok(read("app/(dashboard)/layout.tsx").includes("<UserHelpButton entries={USER_HELP} />"));
  const page = read("app/(marketing)/help/page.tsx");
  assert.ok(page.includes('canonical: "/help"') && page.includes("toolForPath") && page.includes("getFlags"));
  assert.ok(read("lib/seo/index.ts").includes('path: "/help"'), "/help is in the sitemap list");
});

test("sitemap.xml is built from the shared list, so public pages like /getting-started and /tools are in it", () => {
  const s = read("app/sitemap.ts");
  assert.ok(s.includes("STATIC_SITEMAP.map"), "uses the shared list");
  assert.ok(!s.includes("`${siteUrl}/how-it-works`"), "no second hand-written list");
  const list = read("lib/seo/index.ts");
  for (const p of ["/getting-started", "/tools", "/recommendations", "/press-releases", "/help"]) assert.ok(list.includes(`path: "${p}"`), p);
});

test("Batch 23A tools: switches are wired into the pages, buttons, emails and sign-up", () => {
  for (const id of ["matches", "scan_site", "watchlist", "saved_searches", "press_releases", "referrals"]) assert.ok(toolById(id), id);
  assert.equal(toolById("matches")?.flagKey, "feature_tool_matches");
  // pages and buttons
  assert.ok(read("components/watchlist/watchlist-button.tsx").includes('useToolOn("feature_tool_watchlist")'));
  assert.ok(read("components/watchlist/save-search-button.tsx").includes('useToolOn("feature_tool_saved_searches")'));
  assert.ok(read("app/(dashboard)/layout.tsx").includes("ToolFlagsProvider"));
  assert.ok(read("app/(dashboard)/dashboard/sites/page.tsx").includes("feature_tool_matches"));
  assert.ok(read("app/(dashboard)/dashboard/page.tsx").includes("feature_tool_watchlist"));
  assert.ok(read("app/(marketing)/press-releases/page.tsx").includes("feature_tool_press_releases"));
  assert.ok(read("app/(marketing)/referrals/page.tsx").includes("feature_tool_referrals"));
  // emails and sign-up
  const alerts = read("app/api/cron/search-alerts/route.ts");
  assert.ok(alerts.includes("feature_tool_saved_searches") && alerts.includes("feature_tool_watchlist"));
  assert.ok(read("app/api/cron/weekly-digest/route.ts").includes("feature_tool_saved_searches"));
  assert.ok(read("app/api/referral/resolve/route.ts").includes("feature_tool_referrals"));
});

test("price-drop alerts are no longer skipped when nobody has a saved search", () => {
  const alerts = read("app/api/cron/search-alerts/route.ts");
  assert.ok(!/if \(!searches\?\.length\) return NextResponse\.json\(\{ checked: 0, notified: 0 \}\)/.test(alerts), "the early return is gone");
  assert.ok(alerts.indexOf("checkPriceDrops()") > alerts.indexOf("for (const search of searches)"), "price drops run after the loop, whatever it found");
});

test("the admin Tools page shows every group, including Public tools", () => {
  const page = read("app/admin/features/page.tsx");
  assert.ok(page.includes("new Set(TOOLS.map((t) => t.group))"), "groups come from the registry");
  for (const g of new Set(TOOLS.map((t) => t.group))) assert.ok(TOOLS.some((t) => t.group === g));
});

test("gating: the exchange partner page is covered; its look-alikes and the site pages are not", () => {
  assert.equal(toolForPath("/dashboard/sites/abc/matches")?.tool.id, "matches");
  assert.equal(toolForPath("/dashboard/matches")?.tool.id, "matches");
  assert.equal(toolForPath("/api/matches/abc/respond")?.tool.id, "matches");
  for (const p of ["/dashboard/sites", "/dashboard/sites/abc", "/dashboard/sites/abc/slots", "/dashboard/sites/abc/verify", "/dashboard/sites/abc/matches/extra", "/dashboard/sites/matches"]) {
    assert.notEqual(toolForPath(p)?.tool.id, "matches", p);
  }
  assert.equal(toolForPath("/dashboard/scan-site/history")?.tool.id, "scan_site");
  assert.equal(toolForPath("/api/buyer-scan/abc/save")?.tool.id, "scan_site");
  assert.equal(toolForPath("/api/referral/resolve")?.tool.id, "referrals");
  assert.equal(toolForPath("/api/cron/search-alerts"), null, "cron jobs are never gated by tool switches");
});
