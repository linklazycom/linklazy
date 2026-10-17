import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanCompetitors,
  cleanDescription,
  cleanKeywords,
  cleanLine,
  cleanNotes,
  diffKeywords,
  domainOf,
  normalizeProjectUrl,
  validateCountry,
  validateLanguage,
  validateNiche,
  validateProjectName,
} from "@/lib/projects/rules";

const OWN = ["linklazy.com", "www.linklazy.com"];

test("normalizeProjectUrl: adds https, drops query/hash/trailing slash, lowercases host", () => {
  const r = normalizeProjectUrl("Example.COM/Blog/?utm_source=x#top", OWN);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.canonicalUrl, "https://example.com/Blog");
    assert.equal(r.value.domain, "example.com");
  }
});

test("normalizeProjectUrl: bare root keeps a single slash; www is kept in the URL but not in the domain", () => {
  const r = normalizeProjectUrl("https://www.Example.com", OWN);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.canonicalUrl, "https://www.example.com/");
    assert.equal(r.value.domain, "example.com");
  }
});

test("normalizeProjectUrl: default ports vanish, double slashes collapse, other ports are refused", () => {
  const a = normalizeProjectUrl("https://example.com:443//shop//", OWN);
  assert.ok(a.ok);
  if (a.ok) assert.equal(a.value.canonicalUrl, "https://example.com/shop");
  const c = normalizeProjectUrl("http://example.com:80/", OWN);
  assert.ok(c.ok);
  if (c.ok) assert.equal(c.value.canonicalUrl, "http://example.com/");
  // same rule as every other feature: only ports 80/443 (no SSH/DB/admin ports)
  assert.equal(normalizeProjectUrl("http://example.com:8080/", OWN).ok, false);
});

test("normalizeProjectUrl: rejects unsafe or unusable addresses", () => {
  for (const bad of [
    "", "   ", "javascript:alert(1)", "data:text/html,x", "ftp://example.com", "http://localhost",
    "http://127.0.0.1", "http://10.0.0.1/", "http://169.254.169.254/", "https://user:pw@example.com",
    "https://bit.ly/abc", "not a url", "https://linklazy.com/dashboard", "https://www.linklazy.com",
  ]) {
    const r = normalizeProjectUrl(bad, OWN);
    assert.equal(r.ok, false, `should reject ${JSON.stringify(bad)}`);
    if (!r.ok) assert.equal(r.field, "url");
  }
  assert.equal(normalizeProjectUrl(123 as unknown, OWN).ok, false);
});

test("normalizeProjectUrl: the www and non-www forms give the same domain key", () => {
  const a = normalizeProjectUrl("example.com", OWN);
  const b = normalizeProjectUrl("https://www.example.com/", OWN);
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.equal(a.value.domain, b.value.domain);
  assert.equal(domainOf("WWW.Example.com."), "example.com");
});

test("validateProjectName / cleanLine", () => {
  assert.equal(validateProjectName("  My   shop \n").ok, true);
  assert.equal(validateProjectName("   ").ok, false);
  assert.equal(validateProjectName(undefined).ok, false);
  const long = validateProjectName("x".repeat(200));
  assert.ok(long.ok);
  if (long.ok) assert.equal(long.value.length, 80);
  assert.equal(cleanLine("a\u0000b\u0007c", 10), "a b c");
});

test("cleanDescription / cleanNotes keep line breaks, strip control chars, stay plain text", () => {
  assert.equal(cleanDescription("line one\r\nline two\u0000"), "line one\nline two");
  assert.equal(cleanDescription("   \n  "), null);
  assert.equal(cleanDescription(42), null);
  assert.equal(cleanDescription("<script>alert(1)</script>"), "<script>alert(1)</script>"); // stored as text; rendered as text
  assert.equal(cleanNotes("a".repeat(5000))?.length, 2000);
  assert.equal(cleanDescription("x\n".repeat(50))?.split("\n").length, 10);
});

test("cleanKeywords: lines/commas, trims, strips bullets, dedupes ignoring case", () => {
  const r = cleanKeywords("  - Link Building \n• link building\n#seo tips, SEO Tips ;\"guest posts\"", 50);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.keywords, ["Link Building", "seo tips", "guest posts"]);
});

test("cleanKeywords: arrays work; empty input is fine", () => {
  const a = cleanKeywords(["alpha", " beta ", "alpha"], 10);
  assert.ok(a.ok);
  if (a.ok) assert.deepEqual(a.keywords, ["alpha", "beta"]);
  const b = cleanKeywords("", 10);
  assert.ok(b.ok);
  if (b.ok) assert.deepEqual(b.keywords, []);
  const c = cleanKeywords(undefined, 10);
  assert.ok(c.ok);
});

test("cleanKeywords: too short, too long and too many are errors (nothing silently lost)", () => {
  assert.equal(cleanKeywords("a", 10).ok, false);
  assert.equal(cleanKeywords("x".repeat(81), 10).ok, false);
  const many = Array.from({ length: 6 }, (_, i) => `keyword ${i}`).join("\n");
  const r = cleanKeywords(many, 5);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.field, "keywords");
  assert.equal(cleanKeywords(many, 6).ok, true);
  // duplicates do not count towards the limit
  assert.equal(cleanKeywords("a1\nA1\na1\nb2", 2).ok, true);
});

test("cleanCompetitors: reduces to plain domains, skips own domain, dedupes", () => {
  const r = cleanCompetitors("https://www.Rival.com/page\nrival.com, other.org\nmysite.com", { ownDomain: "mysite.com", ownHosts: OWN });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.domains, ["rival.com", "other.org"]);
});

test("cleanCompetitors: rejects junk, private hosts, LinkLazy and more than 10", () => {
  assert.equal(cleanCompetitors("http://localhost", { ownHosts: OWN }).ok, false);
  assert.equal(cleanCompetitors("javascript:alert(1)", { ownHosts: OWN }).ok, false);
  assert.equal(cleanCompetitors("linklazy.com", { ownHosts: OWN }).ok, false);
  const eleven = Array.from({ length: 11 }, (_, i) => `rival${i}.com`);
  const r = cleanCompetitors(eleven, { ownHosts: OWN });
  assert.equal(r.ok, false);
  assert.equal(cleanCompetitors(eleven.slice(0, 10), { ownHosts: OWN }).ok, true);
  const empty = cleanCompetitors("", { ownHosts: OWN });
  assert.ok(empty.ok);
});

test("validateNiche only accepts the site's own niches (any casing) or empty", () => {
  const ok = validateNiche("real estate");
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.value, "Real Estate");
  const empty = validateNiche("");
  assert.ok(empty.ok);
  if (empty.ok) assert.equal(empty.value, null);
  assert.equal(validateNiche("Made-up niche").ok, false);
  assert.equal(validateNiche(5).ok, false);
});

test("validateCountry / validateLanguage normalise and reject", () => {
  const c = validateCountry(" us ");
  assert.ok(c.ok);
  if (c.ok) assert.equal(c.value, "US");
  assert.equal(validateCountry("USA").ok, false);
  assert.equal(validateCountry("1A").ok, false);
  const none = validateCountry(null);
  assert.ok(none.ok);
  if (none.ok) assert.equal(none.value, null);

  const l = validateLanguage("PT-br");
  assert.ok(l.ok);
  if (l.ok) assert.equal(l.value, "pt-BR");
  const e = validateLanguage("EN");
  assert.ok(e.ok);
  if (e.ok) assert.equal(e.value, "en");
  assert.equal(validateLanguage("english").ok, false);
  assert.equal(validateLanguage("en-USA").ok, false);
});

test("diffKeywords: insert only new (ignoring case), delete only the ones removed", () => {
  const existing = [
    { id: "1", keyword: "Alpha" },
    { id: "2", keyword: "beta" },
    { id: "3", keyword: "gamma" },
  ];
  const d = diffKeywords(existing, ["alpha", "Delta", "gamma"]);
  assert.deepEqual(d.toInsert, ["Delta"]);
  assert.deepEqual(d.toDeleteIds, ["2"]);
  const none = diffKeywords(existing, ["ALPHA", "BETA", "GAMMA"]);
  assert.deepEqual(none, { toInsert: [], toDeleteIds: [] });
  assert.deepEqual(diffKeywords(existing, []).toDeleteIds.sort(), ["1", "2", "3"]);
});
