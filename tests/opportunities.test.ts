import test from "node:test";
import assert from "node:assert/strict";
import { hostOfEntry, isBlockedDomain, normalizeUrl, parseOppFilters, parseTypes, validateOppPatch } from "@/lib/opportunities/rules";
import { buildQueries, cleanSubject, projectTerms } from "@/lib/opportunities/queries";
import { scoreHit, SCORE_MAX } from "@/lib/opportunities/score";

test("normalizeUrl: one canonical form per page", () => {
  const a = normalizeUrl("https://www.Example.com/Write-For-Us/?utm_source=x&b=2&a=1#top");
  assert.deepEqual(a, { url: "https://example.com/Write-For-Us?a=1&b=2", domain: "example.com" });
  assert.equal(normalizeUrl("http://example.com:80/")?.url, "http://example.com");
  assert.equal(normalizeUrl("https://example.com//a//b/")?.url, "https://example.com/a/b");
  assert.equal(normalizeUrl("https://example.com:8443/x")?.url, "https://example.com:8443/x");
  for (const bad of ["ftp://example.com", "javascript:alert(1)", "https://localhost/x", "https://127.0.0.1/", "https://user:pw@example.com/", "https://intranet/", "not a url", "https://[::1]/"]) {
    assert.equal(normalizeUrl(bad), null, bad);
  }
  assert.equal(normalizeUrl("https://example.com/p?x=1")?.url, normalizeUrl("https://www.example.com/p/?x=1&fbclid=zz#c")?.url);
});

test("hostOfEntry and blocked domains", () => {
  assert.equal(hostOfEntry("www.Rival.com"), "rival.com");
  assert.equal(hostOfEntry("https://rival.com/about"), "rival.com");
  assert.equal(hostOfEntry("  "), null);
  assert.ok(isBlockedDomain("google.com") && isBlockedDomain("m.facebook.com") && isBlockedDomain("en.wikipedia.org"));
  assert.ok(!isBlockedDomain("notgoogle.com") && !isBlockedDomain("myblog.com"));
});

test("parseTypes keeps valid unique types in fixed order", () => {
  assert.deepEqual(parseTypes(["directory", "guest_post", "directory", "bogus"]), ["guest_post", "directory"]);
  assert.equal(parseTypes([]), null);
  assert.equal(parseTypes(["x"]), null);
  assert.equal(parseTypes("guest_post"), null);
});

test("validateOppPatch", () => {
  assert.deepEqual(validateOppPatch({ status: "saved" }), { ok: true, value: { status: "saved" } });
  const bad = validateOppPatch({ status: "won" });
  assert.ok(!bad.ok && bad.field === "status");
  const cleared = validateOppPatch({ note: "   " });
  assert.ok(cleared.ok && cleared.value.note === null);
  const long = validateOppPatch({ note: "x".repeat(3000) });
  assert.ok(long.ok && long.value.note!.length === 1000);
  assert.ok(!validateOppPatch({}).ok);
});

test("parseOppFilters: safe defaults", () => {
  const f = parseOppFilters({ project: "nope", type: "zzz", status: "all", min: "500", sort: "x", page: "-3" });
  assert.deepEqual(f, { project: null, type: null, status: "all", minScore: 100, sort: "score", page: 1 });
  const g = parseOppFilters({ project: "11111111-1111-4111-8111-111111111111", type: "directory", status: "saved", min: "40", sort: "newest", page: "2" });
  assert.equal(g.project, "11111111-1111-4111-8111-111111111111");
  assert.equal(g.type, "directory");
  assert.equal(g.minScore, 40);
  assert.equal(g.page, 2);
});

test("projectTerms and cleanSubject", () => {
  assert.deepEqual(projectTerms({ niche: "Pet care", keywords: ["dog training", "the best Pet toys"] }), ["pet", "care", "dog", "training", "toys"]);
  assert.equal(cleanSubject('dog "training" (tips)'), "dog training tips");
  assert.deepEqual(projectTerms({ niche: null, keywords: [] }), []);
});

test("buildQueries: fair share between types, capped, deduped; empty without subject", () => {
  const p = { niche: "pet care", keywords: ["dog training", "puppy food"] };
  const q = buildQueries(["guest_post", "directory", "profile", "resource_page", "comment"], p, 6);
  assert.equal(q.length, 6);
  assert.deepEqual(q.slice(0, 5).map((x) => x.type), ["guest_post", "directory", "profile", "resource_page", "comment"]);
  assert.ok(q[0].query.includes("dog training") && q[0].query.includes('"write for us"'));
  assert.equal(new Set(q.map((x) => x.query.toLowerCase())).size, 6);
  const one = buildQueries(["guest_post"], p, 6);
  assert.equal(one.length, 3);
  assert.ok(one[1].query.includes("pet care"), "round 2 uses the niche");
  assert.deepEqual(buildQueries(["guest_post"], { niche: null, keywords: [] }), []);
  assert.ok(buildQueries(["directory"], { niche: 'x "y"', keywords: [] })[0].query.indexOf('x y') >= 0);
});

const NOW = new Date("2026-10-21T00:00:00Z");
const terms = projectTerms({ niche: "pet care", keywords: ["dog training"] });

test("scoreHit: a strong guest-post page scores high, with reasons and confidence", () => {
  const r = scoreHit({
    type: "guest_post",
    terms,
    now: NOW,
    hit: { title: "Write for us | Dog training and pet care tips", url: "https://dogblog.example/write-for-us", snippet: "We accept guest posts about dog training. Read our guidelines and email your pitch to the editor today.", publishedAt: "2026-05-01T00:00:00Z", providerScore: 0.9 },
  });
  assert.equal(r.parts.submission.points, 25);
  assert.equal(r.confidence, "likely");
  assert.equal(r.parts.freshness.points, 10);
  assert.equal(r.parts.clarity.points, 10);
  assert.ok(r.score >= 85, String(r.score));
  assert.ok(r.parts.relevance.points >= 30);
});

test("scoreHit: unrelated page with no evidence scores low and is 'unknown'", () => {
  const r = scoreHit({
    type: "directory",
    terms,
    now: NOW,
    hit: { title: "Cheap casino bonus", url: "http://spam.blogspot.com/a/b/c/d/e", snippet: "", publishedAt: null, providerScore: null },
  });
  assert.equal(r.confidence, "unknown");
  assert.equal(r.parts.submission.points, 0);
  assert.equal(r.parts.relevance.points, 0);
  assert.equal(r.parts.quality.points, 2, "only the title length counts: no https, free host, spam words");
  assert.equal(r.parts.freshness.points, 4);
  assert.ok(r.score <= 10, String(r.score));
});

test("scoreHit: parts never exceed their maximum and the total is within 0-100", () => {
  const types = ["guest_post", "directory", "profile", "resource_page", "comment"] as const;
  for (const type of types) {
    const r = scoreHit({ type, terms, now: NOW, hit: { title: `${type} ${terms.join(" ")} write for us submit your site create a profile useful resources leave a comment`, url: `https://x.example/${type}`, snippet: terms.join(" ").repeat(10), publishedAt: "2026-09-01T00:00:00Z", providerScore: 1 } });
    for (const k of Object.keys(SCORE_MAX) as (keyof typeof SCORE_MAX)[]) {
      assert.ok(r.parts[k].points <= SCORE_MAX[k] && r.parts[k].points >= 0, `${type}.${k}`);
    }
    assert.ok(r.score >= 0 && r.score <= 100);
  }
  const noTerms = scoreHit({ type: "guest_post", terms: [], now: NOW, hit: { title: "t", url: "https://x.example/", snippet: "", publishedAt: null, providerScore: null } });
  assert.equal(noTerms.parts.relevance.points, 0);
});

test("scoreHit: weak words give 'possible'; old pages lose freshness", () => {
  const r = scoreHit({ type: "resource_page", terms, now: NOW, hit: { title: "Pet care links", url: "https://x.example/links", snippet: "A few links about pets and care that we like to share with our readers every week.", publishedAt: "2022-01-01T00:00:00Z", providerScore: null } });
  assert.equal(r.confidence, "possible");
  assert.equal(r.parts.freshness.points, 2);
});
