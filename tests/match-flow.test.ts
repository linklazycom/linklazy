import test from "node:test";
import assert from "node:assert/strict";
import { checkResponder, domainForViewer, isHttpUrl } from "../lib/match-flow.ts";

const A = "user-a";
const B = "user-b";

test("match: outsider denied", () => {
  const r = checkResponder({ status: "proposed", initiated_by: A }, "x", A, B);
  assert.equal(r.ok, false);
});
test("match: receiving side may respond", () => {
  const r = checkResponder({ status: "proposed", initiated_by: A }, B, A, B);
  assert.deepEqual(r, { ok: true, side: "b" });
});
test("match: proposer cannot accept own proposal", () => {
  assert.equal(checkResponder({ status: "proposed", initiated_by: A }, A, A, B).ok, false);
});
test("match: counter-offer sender cannot accept own counter", () => {
  assert.equal(checkResponder({ status: "countered", initiated_by: B }, B, A, B).ok, false);
  assert.equal(checkResponder({ status: "countered", initiated_by: B }, A, A, B).ok, true);
});
test("match: closed proposals cannot be answered again", () => {
  for (const s of ["accepted", "rejected", "expired"]) {
    const r = checkResponder({ status: s, initiated_by: A }, B, A, B);
    assert.equal(r.ok, false);
  }
});
test("match: only http(s) links", () => {
  assert.equal(isHttpUrl("https://example.com/p"), true);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("nope"), false);
});
test("match: domain masked for the other party until accepted", () => {
  const site = { owner_id: A, domain: "example.com" };
  assert.equal(domainForViewer(site, A, "proposed"), "example.com");
  assert.notEqual(domainForViewer(site, B, "proposed"), "example.com");
  assert.equal(domainForViewer(site, B, "accepted"), "example.com");
});

// ---- Batch 23A: the proposer names only their own page; the other owner names theirs ----
import { applyCounter, buildProposedTerms, maskUrl, normalizeHost, resolveAcceptTerms, termsForViewer, urlBelongsToDomain, type MatchTerms } from "../lib/match-flow.ts";
import { acceptTermsSchema, counterSchema, proposeMatchSchema } from "../lib/validators/match.ts";

test("match: a page belongs to a site only when it is the site's domain or a subdomain", () => {
  assert.equal(urlBelongsToDomain("https://example.com/a", "example.com"), true);
  assert.equal(urlBelongsToDomain("https://www.example.com/a", "example.com"), true);
  assert.equal(urlBelongsToDomain("https://blog.example.com/a", "example.com"), true);
  assert.equal(urlBelongsToDomain("https://example.com/a", "www.example.com"), true);
  assert.equal(urlBelongsToDomain("https://EXAMPLE.com./a", "example.com"), true, "case and trailing dot");
  assert.equal(urlBelongsToDomain("https://notexample.com/a", "example.com"), false, "look-alike suffix");
  assert.equal(urlBelongsToDomain("https://example.com.evil.io/a", "example.com"), false);
  assert.equal(urlBelongsToDomain("https://other.org/a", "example.com"), false);
  assert.equal(urlBelongsToDomain("not a url", "example.com"), false);
  assert.equal(normalizeHost(""), null);
});

test("match: masked page address hides the host but keeps the path", () => {
  assert.equal(maskUrl("https://www.example.com/guides/seo"), "https://ex*****.com/guides/seo");
  assert.equal(maskUrl("https://example.com/"), "https://ex*****.com");
  assert.ok(!maskUrl("https://example.com/p").includes("example"));
  assert.equal(maskUrl("garbage"), "****");
});

const A_SITE = { owner_id: A, domain: "alpha.com" };
const B_SITE = { owner_id: B, domain: "beta.org" };
const FIRST: MatchTerms = buildProposedTerms({ my_target_url: "https://alpha.com/page", my_anchor_text: "alpha tips", notes: "hi" });

test("match: a first proposal has only the proposer's page", () => {
  assert.deepEqual(FIRST, { from_a: { target_url: "https://alpha.com/page", anchor_text: "alpha tips" }, notes: "hi" });
  assert.equal(buildProposedTerms({ my_target_url: "https://alpha.com/p", my_anchor_text: "x" }).notes, undefined);
});

test("match: before acceptance each owner sees only their own page address in full", () => {
  const complete: MatchTerms = { from_a: FIRST.from_a, from_b: { target_url: "https://beta.org/review", anchor_text: "beta review" } };
  const forA = termsForViewer(complete, A_SITE, B_SITE, A, "proposed")!;
  assert.equal(forA.from_a.target_url, "https://alpha.com/page");
  assert.equal(forA.from_b!.target_url, "https://be****.org/review");
  const forB = termsForViewer(complete, A_SITE, B_SITE, B, "countered")!;
  assert.equal(forB.from_a.target_url, "https://al****.com/page");
  assert.equal(forB.from_b!.target_url, "https://beta.org/review");
  const after = termsForViewer(complete, A_SITE, B_SITE, B, "accepted")!;
  assert.equal(after.from_a.target_url, "https://alpha.com/page", "revealed once accepted");
  assert.equal(termsForViewer(FIRST, A_SITE, B_SITE, B, "proposed")!.from_b, null, "no second page yet");
  assert.equal(termsForViewer(null, A_SITE, B_SITE, B, "proposed"), null);
});

test("match: accepting a first proposal needs the accepter's own page, on their own site", () => {
  assert.equal(resolveAcceptTerms(FIRST, "b", undefined, "beta.org").ok, false, "no page chosen");
  const wrong = resolveAcceptTerms(FIRST, "b", { target_url: "https://alpha.com/x", anchor_text: "t" }, "beta.org");
  assert.equal(wrong.ok, false, "a page on someone else's site is refused");
  const third = resolveAcceptTerms(FIRST, "b", { target_url: "https://spam.example/x", anchor_text: "t" }, "beta.org");
  assert.equal(third.ok, false, "a third-party address is refused");
  const good = resolveAcceptTerms(FIRST, "b", { target_url: "https://beta.org/review", anchor_text: "beta review" }, "beta.org");
  assert.ok(good.ok && good.filled && good.terms.from_b?.target_url === "https://beta.org/review" && good.terms.from_a === FIRST.from_a);
  // the proposer can never fill in the missing side (that is the other owner's page)
  assert.equal(resolveAcceptTerms(FIRST, "a", { target_url: "https://alpha.com/x", anchor_text: "t" }, "alpha.com").ok, false);
});

test("match: a complete proposal (counter-offer or older one) is accepted as it stands", () => {
  const complete: MatchTerms = { from_a: FIRST.from_a, from_b: { target_url: "https://beta.org/review", anchor_text: "b" } };
  const r = resolveAcceptTerms(complete, "a", { target_url: "https://elsewhere.net", anchor_text: "ignored" }, "alpha.com");
  assert.ok(r.ok && !r.filled && r.terms === complete, "the extra pick is ignored");
});

test("match: a counter-offer changes only the responder's own page and both anchors", () => {
  const r = applyCounter(FIRST, "b", { own_target_url: "https://beta.org/review", own_anchor_text: "beta review", other_anchor_text: "alpha guide" }, "beta.org");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.terms.from_a.target_url, "https://alpha.com/page", "the proposer's page cannot be changed by the responder");
  assert.equal(r.terms.from_a.anchor_text, "alpha guide");
  assert.deepEqual(r.terms.from_b, { target_url: "https://beta.org/review", anchor_text: "beta review" });
  assert.equal(r.terms.notes, "hi", "notes carry over when not replaced");
  // then A counters back: A may change A's page, never B's
  const back = applyCounter(r.terms, "a", { own_target_url: "https://alpha.com/new", own_anchor_text: "alpha new", other_anchor_text: "beta better", notes: "ok?" }, "alpha.com");
  assert.ok(back.ok);
  if (!back.ok) return;
  assert.equal(back.terms.from_a.target_url, "https://alpha.com/new");
  assert.equal(back.terms.from_b!.target_url, "https://beta.org/review");
  assert.equal(back.terms.from_b!.anchor_text, "beta better");
  assert.equal(back.terms.notes, "ok?");
});

test("match: a counter-offer page must be on the responder's own site", () => {
  assert.equal(applyCounter(FIRST, "b", { own_target_url: "https://alpha.com/x", own_anchor_text: "a", other_anchor_text: "b" }, "beta.org").ok, false);
  assert.equal(applyCounter(FIRST, "b", { own_target_url: "https://spam.example/x", own_anchor_text: "a", other_anchor_text: "b" }, "beta.org").ok, false);
  assert.equal(applyCounter({ from_a: FIRST.from_a }, "a", { own_target_url: "https://alpha.com/x", own_anchor_text: "a", other_anchor_text: "b" }, "alpha.com").ok, false, "the other side's page must already exist");
});

test("match: the forms no longer carry a page on the other site", () => {
  const ok = proposeMatchSchema.safeParse({ site_a_id: "7d1c0f12-1111-4111-8111-111111111111", site_b_id: "7d1c0f12-2222-4111-8111-111111111111", my_target_url: "https://alpha.com/p", my_anchor_text: "x", their_target_url: "https://beta.org/p" });
  assert.ok(ok.success);
  assert.ok(!("their_target_url" in (ok.success ? ok.data : {})), "an old client's extra field is dropped, never stored");
  assert.equal(proposeMatchSchema.safeParse({ site_a_id: "x", site_b_id: "y", my_target_url: "javascript:alert(1)", my_anchor_text: "x" }).success, false);
  assert.equal(counterSchema.safeParse({ own_target_url: "https://beta.org/p", own_anchor_text: "a", other_anchor_text: "b" }).success, true);
  assert.equal(counterSchema.safeParse({ own_target_url: "https://beta.org/p", own_anchor_text: "a" }).success, false);
  assert.equal(acceptTermsSchema.safeParse({ target_url: "ftp://beta.org/p", anchor_text: "a" }).success, false);
});
