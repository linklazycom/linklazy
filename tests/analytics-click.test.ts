import { test } from "node:test";
import assert from "node:assert/strict";
import { hashVisitor, utcDay, getHashSecret } from "@/lib/analytics/visitor";
import { buildClickRecord, referrerHost, sourceFromUrl } from "@/lib/analytics/click";
import { fillDaily, parseAnalytics, percent, countryName } from "@/lib/analytics/format";
import { analyticsToCsv } from "@/lib/analytics/csv";

const SECRET = "0123456789abcdef0123456789abcdef";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";

test("visitor hash is stable within a day and never contains the IP", () => {
  const a = hashVisitor(SECRET, "2026-10-15", "203.0.113.7", UA);
  assert.equal(a, hashVisitor(SECRET, "2026-10-15", "203.0.113.7", UA));
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(a.includes("203"), false);
});

test("visitor hash rotates daily and differs by IP, UA and secret", () => {
  const base = hashVisitor(SECRET, "2026-10-15", "203.0.113.7", UA);
  assert.notEqual(base, hashVisitor(SECRET, "2026-10-16", "203.0.113.7", UA));
  assert.notEqual(base, hashVisitor(SECRET, "2026-10-15", "203.0.113.8", UA));
  assert.notEqual(base, hashVisitor(SECRET, "2026-10-15", "203.0.113.7", UA + "x"));
  assert.notEqual(base, hashVisitor(SECRET + "x", "2026-10-15", "203.0.113.7", UA));
});

test("utcDay and getHashSecret", () => {
  assert.equal(utcDay(new Date("2026-10-15T23:59:59Z")), "2026-10-15");
  assert.equal(getHashSecret({ LINK_HASH_SECRET: SECRET }), SECRET);
  assert.equal(getHashSecret({ LINK_HASH_SECRET: "short" }), null);
  const derived = getHashSecret({ PROVIDER_KEY_ENCRYPTION_SECRET: SECRET });
  assert.ok(derived && derived !== SECRET && derived.length === 64);
  assert.equal(getHashSecret({}), null);
});

test("referrerHost strips www, ignores own hosts and junk", () => {
  assert.equal(referrerHost("https://www.Facebook.com/post/1?x=1"), "facebook.com");
  assert.equal(referrerHost("https://linklazy.com/dashboard", ["linklazy.com"]), null);
  assert.equal(referrerHost("https://www.linklazy.com/x", ["linklazy.com"]), null);
  assert.equal(referrerHost("not a url"), null);
  assert.equal(referrerHost(null), null);
  assert.equal(referrerHost("android-app://com.google.android.gm"), "com.google.android.gm");
});

test("sourceFromUrl detects QR scans", () => {
  assert.equal(sourceFromUrl("https://linklazy.com/l/abc?src=qr"), "qr");
  assert.equal(sourceFromUrl("https://linklazy.com/l/abc"), "direct");
  assert.equal(sourceFromUrl("https://linklazy.com/l/abc?src=other"), "direct");
});

test("buildClickRecord assembles a privacy-safe record", () => {
  const r = buildClickRecord({
    url: "https://linklazy.com/l/abc?src=qr", ip: "203.0.113.7", userAgent: UA, referer: "https://t.co/xyz",
    country: "BD", secret: SECRET, now: new Date("2026-10-15T10:00:00Z"),
  });
  assert.equal(r.source, "qr");
  assert.equal(r.country, "BD");
  assert.equal(r.device, "desktop");
  assert.equal(r.browser, "chrome");
  assert.equal(r.referrer_host, "t.co");
  assert.match(r.visitor_hash ?? "", /^[0-9a-f]{32}$/);
  assert.equal(JSON.stringify(r).includes("203.0.113.7"), false);
});

test("buildClickRecord: no secret / unknown IP => no visitor id; bad country dropped", () => {
  const noSecret = buildClickRecord({ url: "https://x.com/l/a", ip: "1.2.3.4", userAgent: UA, referer: null, country: "bd", secret: null });
  assert.equal(noSecret.visitor_hash, null);
  assert.equal(noSecret.country, null);
  const noIp = buildClickRecord({ url: "https://x.com/l/a", ip: "unknown", userAgent: UA, referer: null, country: "US", secret: SECRET });
  assert.equal(noIp.visitor_hash, null);
  assert.equal(noIp.country, "US");
});

test("fillDaily zero-fills the whole window", () => {
  const out = fillDaily([{ day: "2026-10-02", clicks: 5, uniques: 3 }], "2026-10-01", 4);
  assert.deepEqual(out.map((d) => d.day), ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  assert.deepEqual(out.map((d) => d.clicks), [0, 5, 0, 0]);
});

test("parseAnalytics tolerates strings, missing parts and junk", () => {
  assert.equal(parseAnalytics(null), null);
  assert.equal(parseAnalytics("x"), null);
  const a = parseAnalytics({ days: "30", from: "2026-09-16", totals: { clicks: "12", uniques: 9, qr: 2 }, daily: [{ day: "2026-09-16", clicks: 3, uniques: "2" }], countries: [{ key: "BD", clicks: "7" }] })!;
  assert.ok(a);
  assert.equal(a.totals.clicks, 12);
  assert.equal(a.daily[0].uniques, 2);
  assert.equal(a.countries[0].clicks, 7);
  assert.deepEqual(a.devices, []);
});

test("analyticsToCsv has header, daily rows and breakdown rows; guards formulas", () => {
  const a = parseAnalytics({
    days: 2, from: "2026-10-01", totals: { clicks: 3, uniques: 2, qr: 1 },
    daily: [{ day: "2026-10-01", clicks: 3, uniques: 2 }],
    countries: [{ key: "BD", clicks: 3 }], devices: [], browsers: [],
    referrers: [{ key: "=cmd|' /C calc'!A0", clicks: 1 }], sources: [{ key: "qr", clicks: 1 }],
  })!;
  const csv = analyticsToCsv(a);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "section,key,clicks,uniques");
  assert.equal(lines[1], "daily,2026-10-01,3,2");
  assert.equal(lines[2], "daily,2026-10-02,0,0");
  assert.ok(lines.includes("country,BD,3,"));
  assert.ok(lines.some((l) => l.startsWith("referrer,\"'=cmd") || l.startsWith("referrer,'=cmd")));
});

test("percent and countryName", () => {
  assert.equal(percent(1, 3), "33%");
  assert.equal(percent(1, 20), "5%");
  assert.equal(percent(1, 0), "0%");
  assert.equal(countryName("??"), "Unknown");
  assert.equal(countryName("BD"), "Bangladesh");
});
