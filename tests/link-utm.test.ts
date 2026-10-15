import { test } from "node:test";
import assert from "node:assert/strict";
import { applyUtm, readUtm, cleanUtmValue } from "@/lib/links/utm";

test("adds UTM params and keeps existing query + hash", () => {
  const out = applyUtm("https://example.com/p?ref=1#top", { utm_source: "news", utm_medium: "email", utm_campaign: "Spring Sale" });
  const u = new URL(out!);
  assert.equal(u.searchParams.get("ref"), "1");
  assert.equal(u.searchParams.get("utm_source"), "news");
  assert.equal(u.searchParams.get("utm_campaign"), "Spring Sale");
  assert.equal(u.hash, "#top");
});

test("overwrites existing UTM and removes on empty value", () => {
  const out = applyUtm("https://e.com/?utm_source=old&utm_term=x", { utm_source: "new", utm_term: "" });
  const u = new URL(out!);
  assert.equal(u.searchParams.get("utm_source"), "new");
  assert.equal(u.searchParams.has("utm_term"), false);
});

test("ignores keys not provided and rejects non-URLs", () => {
  const out = applyUtm("https://e.com/?utm_source=keep", { utm_medium: "m" });
  assert.equal(new URL(out!).searchParams.get("utm_source"), "keep");
  assert.equal(applyUtm("not a url", { utm_source: "x" }), null);
});

test("values are cleaned and capped", () => {
  assert.equal(cleanUtmValue("  a\nb  "), "ab");
  assert.equal(cleanUtmValue("x".repeat(500)).length, 100);
  assert.equal(cleanUtmValue(42), "");
});

test("readUtm extracts only utm keys", () => {
  assert.deepEqual(readUtm("https://e.com/?a=1&utm_source=s&utm_content=c"), { utm_source: "s", utm_content: "c" });
});
