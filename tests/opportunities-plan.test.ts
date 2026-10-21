import test from "node:test";
import assert from "node:assert/strict";
import { collectCandidates, excludedDomains, planWrites, type Candidate } from "@/lib/opportunities/plan";
import { projectTerms } from "@/lib/opportunities/queries";

const NOW = new Date("2026-10-21T00:00:00Z");
const terms = projectTerms({ niche: "pet care", keywords: ["dog training"] });
const hit = (title: string, url: string, snippet = "") => ({ title, url, snippet, publishedAt: null, providerScore: null });

test("excludedDomains: own site and competitors in any written form", () => {
  const s = excludedDomains("www.Mine.com", ["https://www.rival.com/blog", "other.org", "  ", "not a host"]);
  assert.ok(s.has("mine.com") && s.has("rival.com") && s.has("other.org"));
  assert.equal(s.size, 3);
});

test("collectCandidates: filters, normalises, dedupes by website+kind keeping the best page", () => {
  const exclude = excludedDomains("mine.com", ["rival.com"]);
  const r = collectCandidates(
    [
      {
        type: "guest_post",
        query: "q1",
        provider: "P",
        hits: [
          hit("Home", "https://blog.example/?utm_source=x", "pets"),
          hit("Write for us | dog training and pet care", "https://www.blog.example/write-for-us/#top", "Guest posts about dog training welcome. Read the guidelines."),
          hit("Mine", "https://mine.com/write-for-us"),
          hit("Rival", "https://www.rival.com/write-for-us"),
          hit("Search", "https://www.google.com/search?q=x"),
          hit("Bad", "javascript:alert(1)"),
        ],
      },
      { type: "directory", query: "q2", provider: "P", hits: [hit("Pet directory submit your site", "https://blog.example/directory")] },
    ],
    { terms, exclude, now: NOW }
  );
  assert.equal(r.seen, 7);
  assert.equal(r.dropped, 4); // own, rival, google, javascript:
  assert.equal(r.candidates.length, 2); // blog.example guest_post (best of 2 pages) + blog.example directory
  const guest = r.candidates.find((c) => c.type === "guest_post");
  assert.equal(guest?.url, "https://blog.example/write-for-us");
  assert.equal(guest?.confidence, "likely");
  const dir = r.candidates.find((c) => c.type === "directory");
  assert.equal(dir?.domain, "blog.example");
  assert.ok(r.candidates[0].score >= r.candidates[1].score, "best first");
});

const cand = (domain: string, type: Candidate["type"], score: number): Candidate => ({
  type, url: `https://${domain}/x`, domain, title: "t", snippet: "s", query: "q", provider: "P", score, confidence: "unknown",
  breakdown: {} as Candidate["breakdown"], publishedAt: null,
});

test("planWrites: new rows, better replacements, unchanged, and the capacity limit", () => {
  const existing = [
    { id: "1", domain: "a.example", type: "guest_post", score: 50 },
    { id: "2", domain: "b.example", type: "guest_post", score: 70 },
  ];
  const p = planWrites([cand("a.example", "guest_post", 60), cand("b.example", "guest_post", 70), cand("c.example", "guest_post", 40), cand("a.example", "directory", 30), cand("d.example", "profile", 20)], existing, 2);
  assert.deepEqual(p.updates.map((u) => u.id), ["1"]);
  assert.equal(p.unchanged, 1);
  assert.deepEqual(p.inserts.map((c) => c.domain), ["c.example", "a.example"]);
  assert.equal(p.skippedForCapacity, 1);
  const full = planWrites([cand("z.example", "directory", 90)], [], 0);
  assert.equal(full.inserts.length, 0);
  assert.equal(full.skippedForCapacity, 1);
});
