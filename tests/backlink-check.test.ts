import test from "node:test";
import assert from "node:assert/strict";
import { hostBelongsToDomain, hostKey, matchTarget, urlKey } from "@/lib/backlinks/match";
import { checkBacklink, classifyFetchError, classifyHttpStatus, evaluatePage, orderVerdict, type BacklinkReason } from "@/lib/backlinks/check";
import { linkTypeChips, reasonText, REASON_TEXT, STATUS_LABEL } from "@/lib/backlinks/labels";
import { SafeFetchError, type SafeFetchResponse } from "@/lib/safe-fetch";

const TARGET = "https://me.com/page";
const SRC = "https://blog.example.org/post";

test("matchTarget: scheme, www, trailing slash, fragment and tracking params do not matter", () => {
  for (const href of ["https://me.com/page", "http://me.com/page", "https://www.me.com/page", "https://ME.com/page/", "https://me.com/page#top", "https://me.com/page?utm_source=x&fbclid=1", "https://me.com//page"]) {
    assert.equal(matchTarget(href, TARGET), "exact", href);
  }
});

test("matchTarget: a target without a query accepts any query; a target WITH a query needs the same one", () => {
  assert.equal(matchTarget("https://me.com/page?id=5", TARGET), "exact");
  assert.equal(matchTarget("https://me.com/shop?id=5", "https://me.com/shop?id=5"), "exact");
  assert.equal(matchTarget("https://me.com/shop?id=6", "https://me.com/shop?id=5"), "same_domain");
  assert.equal(matchTarget("https://me.com/shop?b=2&a=1", "https://me.com/shop?a=1&b=2"), "exact");
});

test("matchTarget: same domain but another page, other domains and subdomains", () => {
  assert.equal(matchTarget("https://me.com/other", TARGET), "same_domain");
  assert.equal(matchTarget("https://me.com/", TARGET), "same_domain");
  assert.equal(matchTarget("https://me.com", "https://me.com/"), "exact");
  assert.equal(matchTarget("https://blog.me.com/page", TARGET), "none");
  assert.equal(matchTarget("https://notme.com/page", TARGET), "none");
  assert.equal(matchTarget("ftp://me.com/page", TARGET), "none");
  assert.equal(matchTarget("not a url", TARGET), "none");
  assert.equal(urlKey("javascript:alert(1)"), null);
});

test("hostKey / hostBelongsToDomain", () => {
  assert.equal(hostKey("WWW.Example.com."), "example.com");
  assert.ok(hostBelongsToDomain("shop.example.com", "example.com"));
  assert.ok(hostBelongsToDomain("www.example.com", "example.com"));
  assert.ok(!hostBelongsToDomain("badexample.com", "example.com"));
  assert.ok(!hostBelongsToDomain("example.com", ""));
});

const page = (body: string, extra: Partial<Parameters<typeof evaluatePage>[0]> = {}) => evaluatePage({ html: `<html><body>${body}</body></html>`, pageUrl: SRC, targetUrl: TARGET, ...extra });

test("evaluatePage: a plain link is Active and follow", () => {
  const r = page('<a href="https://me.com/page">my page</a>');
  assert.equal(r.status, "active");
  assert.equal(r.reason, "ok");
  assert.equal(r.isFollow, true);
  assert.equal(r.rel, null);
  assert.equal(r.foundAnchor, "my page");
  assert.equal(r.matchCount, 1);
  assert.ok(r.evidence?.includes("https://me.com/page"));
});

test("evaluatePage: nofollow / sponsored / ugc are reported, never as follow", () => {
  assert.equal(page('<a rel="nofollow" href="https://me.com/page">x</a>').isFollow, false);
  const s = page('<a rel="sponsored ugc" href="https://me.com/page">x</a>');
  assert.equal(s.status, "active");
  assert.equal(s.isFollow, false);
  assert.equal(s.rel, "sponsored ugc");
  assert.equal(page('<a rel="noopener noreferrer" href="https://me.com/page">x</a>').isFollow, true);
});

test("evaluatePage: page-level nofollow (meta or X-Robots-Tag) makes the link not follow; noindex is reported", () => {
  const m = page('<meta name="robots" content="noindex,nofollow"><a href="https://me.com/page">x</a>');
  assert.equal(m.status, "active");
  assert.equal(m.isFollow, false);
  assert.equal(m.pageRobots, "noindex,nofollow");
  const h = page('<a href="https://me.com/page">x</a>', { headers: { "x-robots-tag": "noindex" } });
  assert.equal(h.isFollow, true);
  assert.equal(h.pageRobots, "noindex");
});

test("evaluatePage: with several matching links the follow one (and the expected anchor) is preferred", () => {
  const r = page('<a rel="nofollow" href="https://me.com/page">first</a><a href="https://me.com/page?x=1">second</a>');
  assert.equal(r.matchCount, 2);
  assert.equal(r.isFollow, true);
  assert.equal(r.foundAnchor, "second");
  const a = page('<a href="https://me.com/page">plain</a><a rel="nofollow" href="https://me.com/page">best seo tools</a>', { expectedAnchor: "SEO Tools" });
  assert.equal(a.foundAnchor, "best seo tools");
  assert.equal(a.reason, "ok");
});

test("evaluatePage: expected anchor missing -> still Active but flagged", () => {
  const r = page('<a href="https://me.com/page">click here</a>', { expectedAnchor: "best seo tools" });
  assert.equal(r.status, "active");
  assert.equal(r.reason, "anchor_differs");
});

test("evaluatePage: link to another page of the same site -> Needs review", () => {
  const r = page('<a href="https://me.com/">home</a>');
  assert.equal(r.status, "needs_review");
  assert.equal(r.reason, "other_page_on_domain");
  assert.equal(r.foundHref, "https://me.com/");
  assert.equal(r.isFollow, null);
});

test("evaluatePage: address only written as text or hidden in a script -> Needs review, not Active", () => {
  assert.equal(page("<p>Visit me.com/page today</p>").reason, "mentioned_not_linked");
  assert.equal(page("<p>https://me.com/page</p>").status, "needs_review");
  const root = evaluatePage({ html: "<p>see https://me.com</p>", pageUrl: SRC, targetUrl: "https://me.com/" });
  assert.equal(root.reason, "mentioned_not_linked");
});

test("evaluatePage: missing link on a normal page -> Link not found", () => {
  const r = page('<a href="https://other.com/">x</a><p>nothing here</p>');
  assert.equal(r.status, "not_found");
  assert.equal(r.reason, "link_missing");
  assert.equal(r.matchCount, 0);
  assert.equal(r.foundHref, null);
});

test("evaluatePage: truncated or script-built pages are never reported as 'link not found'", () => {
  const t = page("<p>long page</p>", { truncated: true });
  assert.equal(t.status, "needs_review");
  assert.equal(t.reason, "page_truncated");
  const js = evaluatePage({ html: '<div id="app"></div><script src="/app.js"></script>', pageUrl: SRC, targetUrl: TARGET });
  assert.equal(js.status, "needs_review");
  assert.equal(js.reason, "page_needs_javascript");
  // a real (small) page with its own links and a script is still judged normally
  assert.equal(evaluatePage({ html: '<a href="/x">x</a><script>1</script>', pageUrl: SRC, targetUrl: TARGET }).status, "not_found");
});

test("classifyHttpStatus: errors are 'Source unavailable', never 'Link not found'", () => {
  assert.equal(classifyHttpStatus(200), null);
  assert.equal(classifyHttpStatus(204), null);
  assert.deepEqual(classifyHttpStatus(404), { status: "unavailable", reason: "http_404" });
  assert.deepEqual(classifyHttpStatus(410), { status: "unavailable", reason: "http_410" });
  for (const s of [401, 403, 429]) assert.deepEqual(classifyHttpStatus(s), { status: "unavailable", reason: "access_denied" });
  for (const s of [500, 502, 503]) assert.deepEqual(classifyHttpStatus(s), { status: "unavailable", reason: "http_5xx" });
  assert.deepEqual(classifyHttpStatus(418), { status: "unavailable", reason: "http_4xx" });
  assert.deepEqual(classifyHttpStatus(304), { status: "check_failed", reason: "http_other" });
});

test("classifyFetchError maps safe-fetch errors; temporary problems are not removals", () => {
  assert.deepEqual(classifyFetchError(new SafeFetchError("timeout", "t")), { status: "unavailable", reason: "timeout" });
  assert.deepEqual(classifyFetchError(new SafeFetchError("network", "n")), { status: "unavailable", reason: "network" });
  assert.deepEqual(classifyFetchError(new SafeFetchError("too_many_redirects", "r")), { status: "unavailable", reason: "too_many_redirects" });
  assert.deepEqual(classifyFetchError(new SafeFetchError("blocked", "b")), { status: "check_failed", reason: "blocked_url" });
  assert.deepEqual(classifyFetchError(new SafeFetchError("invalid_url", "b")), { status: "check_failed", reason: "blocked_url" });
  assert.deepEqual(classifyFetchError(new SafeFetchError("too_large", "b")), { status: "check_failed", reason: "too_large" });
  assert.deepEqual(classifyFetchError(new Error("boom")), { status: "check_failed", reason: "internal" });
  assert.deepEqual(classifyFetchError("weird"), { status: "check_failed", reason: "internal" });
});

const res = (over: Partial<SafeFetchResponse> = {}): SafeFetchResponse => ({ status: 200, ok: true, url: SRC, headers: { "content-type": "text/html; charset=utf-8" }, text: "", truncated: false, ...over });

test("checkBacklink: found / missing / HTTP errors / fetch errors, with a fake fetcher (no network)", async () => {
  const input = { sourceUrl: SRC, targetUrl: TARGET };
  const ok = await checkBacklink(input, { fetch: async () => res({ text: '<a href="https://me.com/page">hi</a>' }) });
  assert.equal(ok.status, "active");
  assert.equal(ok.httpStatus, 200);
  assert.equal(ok.finalUrl, SRC);

  const missing = await checkBacklink(input, { fetch: async () => res({ text: "<p>no links</p>" }) });
  assert.equal(missing.status, "not_found");

  const gone = await checkBacklink(input, { fetch: async () => res({ status: 404, ok: false, text: "nope" }) });
  assert.equal(gone.status, "unavailable");
  assert.equal(gone.reason, "http_404");
  assert.equal(gone.httpStatus, 404);

  const blocked = await checkBacklink(input, { fetch: async () => res({ status: 403, ok: false }) });
  assert.equal(blocked.reason, "access_denied");

  for (const [code, status, reason] of [["timeout", "unavailable", "timeout"], ["network", "unavailable", "network"], ["blocked", "check_failed", "blocked_url"]] as const) {
    const r = await checkBacklink(input, { fetch: async () => { throw new SafeFetchError(code, "x"); } });
    assert.equal(r.status, status);
    assert.equal(r.reason, reason);
    assert.equal(r.httpStatus, null);
    assert.equal(r.foundHref, null);
  }
  const weird = await checkBacklink(input, { fetch: async () => { throw new TypeError("kaboom"); } });
  assert.equal(weird.reason, "internal");
});

test("checkBacklink: non-HTML content and a missing content-type", async () => {
  const input = { sourceUrl: SRC, targetUrl: TARGET };
  const pdf = await checkBacklink(input, { fetch: async () => res({ headers: { "content-type": "application/pdf" }, text: "%PDF" }) });
  assert.equal(pdf.status, "needs_review");
  assert.equal(pdf.reason, "not_html");
  const none = await checkBacklink(input, { fetch: async () => res({ headers: {}, text: '<a href="https://me.com/page">x</a>' }) });
  assert.equal(none.status, "active");
});

test("checkBacklink: reports duration from the injected clock and uses the final URL for relative links", async () => {
  let t = 1000;
  const r = await checkBacklink(
    { sourceUrl: "https://short.example.org/r", targetUrl: "https://me.com/x" },
    { now: () => (t += 250), fetch: async () => res({ url: "https://real.example.org/dir/page", text: '<a href="https://me.com/x">a</a>' }) }
  );
  assert.equal(r.durationMs, 250);
  assert.equal(r.finalUrl, "https://real.example.org/dir/page");
});

test("orderVerdict keeps the old meaning of the order link-checker and stops false alarms", () => {
  assert.equal(orderVerdict({ status: "active", reason: "ok" }), "ok");
  assert.equal(orderVerdict({ status: "active", reason: "anchor_differs" }), "ok");
  assert.equal(orderVerdict({ status: "needs_review", reason: "mentioned_not_linked" }), "ok");
  assert.equal(orderVerdict({ status: "not_found", reason: "link_missing" }), "down");
  assert.equal(orderVerdict({ status: "needs_review", reason: "other_page_on_domain" }), "down");
  assert.equal(orderVerdict({ status: "check_failed", reason: "blocked_url" }), "skipped");
  for (const [status, reason] of [["unavailable", "http_404"], ["unavailable", "timeout"], ["unavailable", "access_denied"], ["needs_review", "page_truncated"], ["needs_review", "page_needs_javascript"], ["check_failed", "internal"]] as const) {
    assert.equal(orderVerdict({ status, reason }), "unverified", `${status}/${reason}`);
  }
});

test("labels: every reason has plain text; chips describe follow / nofollow / page-level flags", () => {
  const reasons = Object.keys(REASON_TEXT) as BacklinkReason[];
  assert.ok(reasons.length >= 19);
  for (const r of reasons) assert.ok(reasonText(r).length > 10, r);
  assert.equal(reasonText(null), "");
  assert.equal(reasonText("not-a-reason"), "");
  assert.equal(STATUS_LABEL.not_found, "Link not found");
  assert.deepEqual(linkTypeChips(null, true, null), [{ label: "Follow", tone: "good" }]);
  assert.deepEqual(linkTypeChips("sponsored ugc", false, "noindex"), [{ label: "Sponsored", tone: "warn" }, { label: "UGC", tone: "warn" }, { label: "Page is noindex", tone: "info" }]);
  assert.deepEqual(linkTypeChips(null, false, "nofollow"), [{ label: "Page-level nofollow", tone: "warn" }]);
  assert.deepEqual(linkTypeChips(null, null, null), []);
});
