import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTags, cleanText, parseExpiry, safeSearchTerm } from "@/lib/links/fields";
import { resolveLimits, effectiveCaps, DEFAULT_LINK_LIMITS } from "@/lib/links/limits";

test("cleanTags normalizes, dedupes and caps", () => {
  assert.deepEqual(cleanTags("Black Friday, promo ;PROMO|  x!y "), ["black-friday", "promo", "xy"]);
  assert.equal(cleanTags(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, 10);
  assert.deepEqual(cleanTags(undefined), []);
});

test("cleanText trims, collapses and caps", () => {
  assert.equal(cleanText("  a \n b  ", 10), "a b");
  assert.equal(cleanText("   ", 10), null);
  assert.equal(cleanText("abcdef", 3), "abc");
  assert.equal(cleanText(5, 3), null);
});

test("parseExpiry", () => {
  const now = new Date("2026-10-15T00:00:00Z");
  assert.equal(parseExpiry("", now), null);
  assert.equal(parseExpiry(null, now), null);
  assert.equal(parseExpiry("garbage", now), "invalid");
  assert.equal(parseExpiry("2026-10-14T00:00:00Z", now), "past");
  assert.equal(parseExpiry("2026-12-01T00:00:00Z", now), "2026-12-01T00:00:00.000Z");
  assert.equal(parseExpiry("2099-01-01T00:00:00Z", now), "invalid");
});

test("safeSearchTerm removes PostgREST filter syntax", () => {
  assert.equal(safeSearchTerm("a,b)(c*d%e"), "a b c d e");
  assert.equal(safeSearchTerm(undefined), "");
  assert.equal(safeSearchTerm("x".repeat(200)).length, 80);
});

test("resolveLimits uses defaults, accepts valid and ignores junk", () => {
  assert.deepEqual(resolveLimits(null), DEFAULT_LINK_LIMITS);
  const l = resolveLimits([
    { key: "link_max_per_user", value: 80 },
    { key: "link_create_per_hour", value: "15" },
    { key: "link_bulk_max_rows", value: -5 },
    { key: "link_new_account_max", value: 2.5 },
    { key: "unknown", value: 1 },
  ]);
  assert.equal(l.link_max_per_user, 80);
  assert.equal(l.link_create_per_hour, 15);
  assert.equal(l.link_bulk_max_rows, DEFAULT_LINK_LIMITS.link_bulk_max_rows);
  assert.equal(l.link_new_account_max, DEFAULT_LINK_LIMITS.link_new_account_max);
});

test("effectiveCaps applies the stricter new-account caps", () => {
  const now = new Date("2026-10-15T00:00:00Z");
  const fresh = effectiveCaps(DEFAULT_LINK_LIMITS, "2026-10-13T00:00:00Z", now);
  assert.equal(fresh.isNewAccount, true);
  assert.equal(fresh.maxLinks, 10);
  const old = effectiveCaps(DEFAULT_LINK_LIMITS, "2026-01-01T00:00:00Z", now);
  assert.equal(old.isNewAccount, false);
  assert.equal(old.maxLinks, 50);
  assert.equal(effectiveCaps(DEFAULT_LINK_LIMITS, null, now).isNewAccount, false);
});
