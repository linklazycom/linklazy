import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSlug, generateSlug, isPlausibleSlug, extractSlug, RESERVED_SLUGS } from "@/lib/links/slug";

test("validateSlug lowercases and accepts good slugs", () => {
  const r = validateSlug("  My-Promo_2026 ");
  assert.deepEqual(r, { ok: true, slug: "my-promo_2026" });
});

test("validateSlug rejects bad slugs", () => {
  const bad: [string, string][] = [
    ["ab", "too_short"],
    ["a".repeat(41), "too_long"],
    ["hello world", "bad_chars"],
    ["héllo", "bad_chars"],
    ["-abc", "bad_edges"],
    ["abc_", "bad_edges"],
    ["admin", "reserved"],
    ["API", "reserved"],
  ];
  for (const [input, error] of bad) {
    const r = validateSlug(input);
    assert.equal(r.ok, false, input);
    if (!r.ok) assert.equal(r.error, error, input);
  }
});

test("reserved list covers key routes", () => {
  for (const s of ["admin", "api", "login", "dashboard", "l", "bio"]) assert.ok(RESERVED_SLUGS.has(s), s);
});

test("generateSlug produces valid, unambiguous slugs", () => {
  for (let i = 0; i < 200; i++) {
    const s = generateSlug();
    assert.equal(s.length, 7);
    assert.match(s, /^[abcdefghjkmnpqrstuvwxyz23456789]{7}$/);
    assert.ok(isPlausibleSlug(s));
  }
});

test("generateSlug uses injected bytes deterministically and skips biased bytes", () => {
  const s = generateSlug(3, () => new Uint8Array([255, 0, 1, 2, 0, 0]));
  assert.equal(s, "abc"); // 255 is rejected (>= 248), then 0,1,2
});

test("extractSlug handles URLs and bare slugs", () => {
  assert.equal(extractSlug("https://linklazy.com/l/Promo?x=1#y"), "promo");
  assert.equal(extractSlug("linklazy.com/l/abc-def"), "abc-def");
  assert.equal(extractSlug("abc123"), "abc123");
  assert.equal(extractSlug("https://example.com/other"), null);
  assert.equal(extractSlug(""), null);
});
