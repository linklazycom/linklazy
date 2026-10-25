import test from "node:test";
import assert from "node:assert/strict";
import { computePriceStats, decideToolAccess, drWindow, normalizeDomainInput, normalizePageInput, parseDr, pickRecommendations, PRICE_CHECK_MIN_SAMPLES, TOOL_LIMITS } from "@/lib/growth/rules";

test("normalizeDomainInput: a bare public domain or nothing", () => {
  assert.equal(normalizeDomainInput("https://www.Example.com/path?x=1"), "example.com");
  assert.equal(normalizeDomainInput("  blog.example.org "), "blog.example.org");
  for (const bad of ["", "localhost", "127.0.0.1", "http://192.168.1.1", "javascript:alert(1)", "not a domain", "a".repeat(400) + ".com", null, 5]) {
    assert.equal(normalizeDomainInput(bad as unknown), null, String(bad));
  }
});

test("normalizePageInput adds https and canonicalises; rejects non-web addresses", () => {
  assert.equal(normalizePageInput("example.com/page/"), "https://example.com/page");
  assert.equal(normalizePageInput("http://www.example.com/?utm_source=x"), "http://example.com");
  assert.equal(normalizePageInput("ftp://example.com"), null);
  assert.equal(normalizePageInput("https://user:pw@example.com/"), null);
  assert.equal(normalizePageInput(""), null);
});

test("parseDr: integers 0 to 100 only", () => {
  assert.equal(parseDr("45"), 45);
  assert.equal(parseDr(0), 0);
  assert.equal(parseDr(100), 100);
  for (const bad of ["", "abc", "45.5", -1, 101, "101", null, undefined, NaN]) assert.equal(parseDr(bad as unknown), null, String(bad));
});

test("drWindow stays inside 0..100", () => {
  assert.deepEqual(drWindow(45), [40, 50]);
  assert.deepEqual(drWindow(2), [0, 7]);
  assert.deepEqual(drWindow(98), [93, 100]);
});

test("computePriceStats: honest about too little data", () => {
  assert.equal(computePriceStats([100, 200, 300, 400]), null, `needs ${PRICE_CHECK_MIN_SAMPLES} prices`);
  assert.equal(computePriceStats([0, -5, NaN, 10, 20, 30, 40]), null, "zero, negative and NaN do not count");
  const s = computePriceStats([500, 100, 300, 200, 400, 600, 700, 800, 900, 1000])!;
  assert.deepEqual(s, { count: 10, min: 100, p25: 300, median: 500, p75: 800, max: 1000 });
  const five = computePriceStats([10, 20, 30, 40, 50])!;
  assert.equal(five.median, 30);
  assert.equal(five.min, 10);
  assert.equal(five.max, 50);
});

test("pickRecommendations: best DR first, cheaper on ties, only public fields, at most the limit", () => {
  const mk = (id: string, dr: number | null, price: number | null) => ({ id, niche: "Pets", dr, da: 10, price_amount: price, turnaround_hours: 48, owner_id: "secret", domain: "secret.com" });
  const out = pickRecommendations([mk("a", 30, 100), mk("b", 50, 900), mk("c", 50, 400), mk("d", null, 50), mk("e", 10, null), mk("f", 20, 10), mk("g", 5, 5)] as never, 5);
  assert.deepEqual(out.map((s) => s.id), ["c", "b", "a", "f", "e"]);
  for (const s of out) assert.deepEqual(Object.keys(s).sort(), ["da", "dr", "id", "niche", "price_amount", "turnaround_hours"]);
});

test("decideToolAccess: switch first, then the whole-site ceiling, then the visitor's limits", () => {
  const ok = { enabled: true, ipHourOk: true, ipDayOk: true, globalOk: true };
  assert.deepEqual(decideToolAccess(ok), { ok: true });
  assert.deepEqual(decideToolAccess({ ...ok, enabled: false, ipHourOk: false }), { ok: false, status: 503, error: "This tool is currently switched off." });
  const g = decideToolAccess({ ...ok, globalOk: false });
  assert.ok(!g.ok && g.status === 503);
  const h = decideToolAccess({ ...ok, ipHourOk: false });
  assert.ok(!h.ok && h.status === 429 && /hour/.test(h.error));
  const d = decideToolAccess({ ...ok, ipDayOk: false });
  assert.ok(!d.ok && d.status === 429 && /today/.test(d.error));
});

test("limits are sane: per-visitor ceilings are below the whole-site ceiling", () => {
  assert.ok(TOOL_LIMITS.dr.perIpHour <= TOOL_LIMITS.dr.perIpDay && TOOL_LIMITS.dr.perIpDay < TOOL_LIMITS.dr.globalDay);
  assert.ok(TOOL_LIMITS.recommend.perIpHour <= TOOL_LIMITS.recommend.perIpDay && TOOL_LIMITS.recommend.perIpDay < TOOL_LIMITS.recommend.globalDay);
});
