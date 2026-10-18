import test from "node:test";
import assert from "node:assert/strict";
import { BACKLINK_EXPORT_HEADERS, IMPORT_MAX_ROWS, linkTypeLabel, normalizePageUrl, parseBacklinkCsv, validateBacklinkFields } from "@/lib/backlinks/rules";

const OWN = ["linklazy.com", "www.linklazy.com"];

test("normalizePageUrl: adds https, drops fragment and trailing slash, keeps the query, lowercases host", () => {
  const r = normalizePageUrl("Blog.Example.ORG/Post/One/?page=2#comments", "source_url", OWN);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.url, "https://blog.example.org/Post/One?page=2");
    assert.equal(r.value.domain, "blog.example.org");
  }
  const root = normalizePageUrl("https://www.Example.org", "target_url", OWN);
  assert.ok(root.ok);
  if (root.ok) {
    assert.equal(root.value.url, "https://www.example.org/");
    assert.equal(root.value.domain, "example.org");
  }
});

test("normalizePageUrl: rejects unsafe or unusable addresses and reports the right field", () => {
  for (const bad of ["", "javascript:alert(1)", "http://localhost/x", "http://127.0.0.1/", "http://10.0.0.5/a", "http://169.254.169.254/latest", "https://user:pw@example.com/", "https://bit.ly/abc", "http://example.com:8080/x", "https://linklazy.com/l/abc", "https://www.linklazy.com/"]) {
    const r = normalizePageUrl(bad, "source_url", OWN);
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.equal(r.field, "source_url");
  }
  assert.equal(normalizePageUrl(42 as unknown, "target_url", OWN).ok, false);
});

test("validateBacklinkFields: cleans anchor and note, refuses identical pages, reports which URL is wrong", () => {
  const ok = validateBacklinkFields({ source_url: "blog.example.org/a", target_url: "https://me.com/p", anchor_text: "  best   widgets \n", note: "guest\u0000 post" });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.anchor, "best widgets");
    assert.equal(ok.value.note, "guest post");
    assert.equal(ok.value.source.domain, "blog.example.org");
  }
  const same = validateBacklinkFields({ source_url: "https://me.com/p/", target_url: "https://me.com/p" });
  assert.equal(same.ok, false);
  const badTarget = validateBacklinkFields({ source_url: "https://a.com/x", target_url: "http://localhost" });
  assert.ok(!badTarget.ok);
  if (!badTarget.ok) assert.equal(badTarget.field, "target_url");
  const none = validateBacklinkFields({ source_url: "https://a.com/x", target_url: "https://b.com/", anchor_text: "   ", note: undefined });
  assert.ok(none.ok);
  if (none.ok) {
    assert.equal(none.value.anchor, null);
    assert.equal(none.value.note, null);
  }
  const long = validateBacklinkFields({ source_url: "https://a.com/x", target_url: "https://b.com/", anchor_text: "x".repeat(400) });
  assert.ok(long.ok);
  if (long.ok) assert.equal(long.value.anchor?.length, 150);
});

test("parseBacklinkCsv: required columns, aliases, optional columns, line numbers", () => {
  const r = parseBacklinkCsv("source,your_url,anchor,note\nhttps://a.com/x,https://me.com/p,my anchor,hello\nhttps://b.com/y,https://me.com/q,,\n", 100);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.rows.length, 2);
    assert.deepEqual(r.rows[0], { line: 2, source_url: "https://a.com/x", target_url: "https://me.com/p", anchor_text: "my anchor", note: "hello" });
    assert.equal(r.rows[1].anchor_text, null);
    assert.equal(r.rows[1].line, 3);
  }
});

test("parseBacklinkCsv: clear errors for empty, missing columns, no rows and too many rows", () => {
  assert.equal(parseBacklinkCsv("", 10).ok, false);
  const a = parseBacklinkCsv("target_url\nhttps://x.com\n", 10);
  assert.ok(!a.ok);
  if (!a.ok) assert.ok(a.error.includes("source_url"));
  const b = parseBacklinkCsv("source_url\nhttps://x.com\n", 10);
  assert.ok(!b.ok);
  if (!b.ok) assert.ok(b.error.includes("target_url"));
  assert.equal(parseBacklinkCsv("source_url,target_url\n", 10).ok, false);
  const rows = Array.from({ length: 6 }, (_, i) => `https://s${i}.com/a,https://me.com/p`).join("\n");
  const many = parseBacklinkCsv(`source_url,target_url\n${rows}\n`, 5);
  assert.ok(!many.ok);
  // the hard cap applies even when a larger limit is passed in
  const big = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `https://s${i}.com/a,https://me.com/p`).join("\n");
  assert.equal(parseBacklinkCsv(`source_url,target_url\n${big}\n`, 100_000).ok, false);
});

test("parseBacklinkCsv: quoted cells with commas and a BOM", () => {
  const r = parseBacklinkCsv('\uFEFFsource_url,target_url,anchor_text\n"https://a.com/x?a=1,2",https://me.com/p,"best, cheap widgets"\n', 10);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.rows[0].source_url, "https://a.com/x?a=1,2");
    assert.equal(r.rows[0].anchor_text, "best, cheap widgets");
  }
});

test("linkTypeLabel and export headers", () => {
  assert.equal(linkTypeLabel(null, null), "");
  assert.equal(linkTypeLabel(null, true), "follow");
  assert.equal(linkTypeLabel("nofollow", false), "nofollow");
  assert.equal(linkTypeLabel("sponsored ugc", false), "sponsored ugc");
  assert.equal(linkTypeLabel(null, false), "nofollow (page-level)");
  assert.ok(BACKLINK_EXPORT_HEADERS.includes("status"));
  assert.equal(new Set(BACKLINK_EXPORT_HEADERS).size, BACKLINK_EXPORT_HEADERS.length);
});
