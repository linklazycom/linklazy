import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchRequest, isSearchAdapter, parseSearchResponse } from "@/lib/providers/search";

test("tavily request: POST with bearer key and a capped result count", () => {
  const r = buildSearchRequest({ adapter: "tavily", baseUrl: null, apiKey: "tvly-abc", engineId: null, query: "  pet   blog  ", maxResults: 50 });
  assert.equal(r.method, "POST");
  assert.equal(r.url, "https://api.tavily.com/search");
  assert.equal(r.headers.authorization, "Bearer tvly-abc");
  const body = JSON.parse(r.body ?? "{}");
  assert.equal(body.query, "pet blog");
  assert.equal(body.max_results, 10);
  assert.equal(body.include_answer, false);
  assert.throws(() => buildSearchRequest({ adapter: "tavily", baseUrl: null, apiKey: null, engineId: null, query: "x", maxResults: 5 }), /No API key/);
});

test("google_cse request: key and engine id in the query string; engine id required", () => {
  const r = buildSearchRequest({ adapter: "google_cse", baseUrl: null, apiKey: "K", engineId: "cx123", query: "write for us", maxResults: 3 });
  assert.equal(r.method, "GET");
  const u = new URL(r.url);
  assert.equal(u.origin + u.pathname, "https://www.googleapis.com/customsearch/v1");
  assert.equal(u.searchParams.get("cx"), "cx123");
  assert.equal(u.searchParams.get("q"), "write for us");
  assert.equal(u.searchParams.get("num"), "3");
  assert.throws(() => buildSearchRequest({ adapter: "google_cse", baseUrl: null, apiKey: "K", engineId: null, query: "x", maxResults: 3 }), /engine id/);
});

test("searxng request: base URL required, key optional", () => {
  const r = buildSearchRequest({ adapter: "searxng", baseUrl: "https://s.example.org/", apiKey: null, engineId: null, query: "a b", maxResults: 5 });
  assert.equal(r.url, "https://s.example.org/search?q=a+b&format=json");
  assert.equal(r.headers.authorization, undefined);
  assert.throws(() => buildSearchRequest({ adapter: "searxng", baseUrl: null, apiKey: null, engineId: null, query: "a", maxResults: 5 }), /base URL/);
});

test("parseSearchResponse: tavily keeps good hits, drops bad addresses, cleans text", () => {
  const hits = parseSearchResponse("tavily", {
    results: [
      { title: "Write for us\u0000 | Pets", url: "https://a.example/write-for-us", content: "  Send   a pitch ", score: 0.8, published_date: "2026-03-01" },
      { title: "bad", url: "javascript:alert(1)", content: "x" },
      { title: "no url" },
      { title: "T", url: "https://b.example/", content: "c", score: 7 },
    ],
  });
  assert.equal(hits.length, 2);
  assert.equal(hits[0].title, "Write for us | Pets");
  assert.equal(hits[0].snippet, "Send a pitch");
  assert.equal(hits[0].providerScore, 0.8);
  assert.equal(hits[0].publishedAt, "2026-03-01T00:00:00.000Z");
  assert.equal(hits[1].providerScore, null);
  assert.throws(() => parseSearchResponse("tavily", { nothing: true }), /no results list/);
  assert.deepEqual(parseSearchResponse("tavily", { results: [] }), []);
});

test("parseSearchResponse: google_cse and searxng shapes", () => {
  const g = parseSearchResponse("google_cse", { items: [{ title: "A", link: "https://g.example/x", snippet: "s" }, { title: "B" }] });
  assert.equal(g.length, 1);
  assert.equal(g[0].url, "https://g.example/x");
  assert.deepEqual(parseSearchResponse("google_cse", {}), []);
  assert.throws(() => parseSearchResponse("google_cse", { error: { code: 403 } }), /error/);
  const s = parseSearchResponse("searxng", { results: [{ title: "S", url: "https://s.example/p", content: "c", publishedDate: "2025-01-02T00:00:00" }] });
  assert.equal(s[0].snippet, "c");
  assert.ok(s[0].publishedAt?.startsWith("2025-01-02"));
});

test("isSearchAdapter", () => {
  assert.ok(isSearchAdapter("tavily") && isSearchAdapter("searxng") && isSearchAdapter("google_cse"));
  assert.ok(!isSearchAdapter("brave") && !isSearchAdapter(null));
});
