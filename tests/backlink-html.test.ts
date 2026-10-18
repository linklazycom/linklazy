import test from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, extractPageInfo, parseAttributes, MAX_ANCHORS } from "@/lib/backlinks/html";

const PAGE = "https://blog.example.org/posts/one";

test("decodeEntities handles named, decimal and hex entities and leaves unknown ones", () => {
  assert.equal(decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x41; &nbsp;f"), "a & b <c> \"d\" 'e' A  f");
  assert.equal(decodeEntities("&bogus; &#99999999999;"), "&bogus; &#99999999999;");
});

test("parseAttributes: quotes, unquoted values, case, duplicates, '>' inside quotes", () => {
  const a = parseAttributes('<a HREF="https://x.com/?a=1&amp;b=2" rel=nofollow class=\'big\' title="a > b" data-x>');
  assert.equal(a.href, "https://x.com/?a=1&b=2");
  assert.equal(a.rel, "nofollow");
  assert.equal(a.class, "big");
  assert.equal(a.title, "a > b");
  assert.equal(a["data-x"], "");
  assert.equal(parseAttributes('<a href="one" href="two">').href, "one");
});

test("extractPageInfo: finds links, resolves relative URLs, reads rel and visible text", () => {
  const html = `<html><body>
    <a href="https://me.com/page" rel="Nofollow  UGC">  My <b>great</b>\n page </a>
    <a href="/about">About</a>
    <A HREF='../up'>Up</A>
  </body></html>`;
  const info = extractPageInfo(html, PAGE);
  assert.equal(info.links.length, 3);
  assert.equal(info.links[0].url, "https://me.com/page");
  assert.deepEqual(info.links[0].rel, ["nofollow", "ugc"]);
  assert.equal(info.links[0].text, "My great page");
  assert.equal(info.links[1].url, "https://blog.example.org/about");
  assert.equal(info.links[2].url, "https://blog.example.org/up");
  assert.ok(info.links[0].snippet.startsWith("<a href="));
  assert.equal(info.anchorCount, 3);
});

test("extractPageInfo: <base href> changes how relative links resolve", () => {
  const info = extractPageInfo('<base href="https://cdn.example.net/dir/"><a href="x">x</a>', PAGE);
  assert.equal(info.links[0].url, "https://cdn.example.net/dir/x");
});

test("extractPageInfo: skips javascript:, mailto:, tel:, #fragment and empty hrefs", () => {
  const html = '<a href="javascript:alert(1)">a</a><a href="mailto:x@y.z">b</a><a href="tel:123">c</a><a href="#top">d</a><a href="">e</a><a>f</a><a href="https://ok.com/">g</a>';
  const info = extractPageInfo(html, PAGE);
  assert.deepEqual(info.links.map((l) => l.url), ["https://ok.com/"]);
});

test("extractPageInfo: links inside comments, scripts, styles and templates are not real links", () => {
  const html = '<!-- <a href="https://fake.com/1">x</a> --><script>var s = \'<a href="https://fake.com/2">x</a>\';</script><style>/* <a href="https://fake.com/3"> */</style><template><a href="https://fake.com/4">x</a></template><a href="https://real.com/">real</a>';
  const info = extractPageInfo(html, PAGE);
  assert.deepEqual(info.links.map((l) => l.url), ["https://real.com/"]);
  assert.equal(info.hasScripts, true);
});

test("extractPageInfo: image-only anchors use the alt text; entities are decoded in text", () => {
  const info = extractPageInfo('<a href="https://me.com/"><img src="/l.png" alt="My &amp; Logo"></a><a href="https://me.com/2">Tom &amp; Jerry</a><a href="https://me.com/3"><img src="x.png"></a>', PAGE);
  assert.equal(info.links[0].text, "[image: My & Logo]");
  assert.equal(info.links[1].text, "Tom & Jerry");
  assert.equal(info.links[2].text, "[image]");
});

test("extractPageInfo: page-level robots from meta tags", () => {
  assert.deepEqual(extractPageInfo('<meta name="robots" content="noindex, nofollow">', PAGE).robots, { noindex: true, nofollow: true });
  assert.deepEqual(extractPageInfo('<META NAME="Googlebot" CONTENT="NOFOLLOW">', PAGE).robots, { noindex: false, nofollow: true });
  assert.deepEqual(extractPageInfo('<meta name="robots" content="none">', PAGE).robots, { noindex: true, nofollow: true });
  assert.deepEqual(extractPageInfo('<meta name="robots" content="index,follow"><meta name="viewport" content="x">', PAGE).robots, { noindex: false, nofollow: false });
});

test("extractPageInfo: unclosed and nested anchors do not swallow later links", () => {
  const html = '<a href="https://a.com/">one <a href="https://b.com/">two</a> <a href="https://c.com/">three';
  const info = extractPageInfo(html, PAGE);
  assert.deepEqual(info.links.map((l) => l.url), ["https://a.com/", "https://b.com/", "https://c.com/"]);
  assert.equal(info.links[0].text, "one");
  assert.equal(info.links[1].text, "two");
});

test("extractPageInfo: a '>' inside a quoted attribute does not end the tag early", () => {
  const info = extractPageInfo('<a title="a > b" href="https://me.com/x">ok</a>', PAGE);
  assert.equal(info.links[0].url, "https://me.com/x");
  assert.equal(info.links[0].text, "ok");
});

test("extractPageInfo: hostile input stays fast and bounded (linear, capped)", () => {
  const started = Date.now();
  const unclosed = "<a href=\"https://x.com/\">".repeat(80_000); // ~2 MB of unclosed anchors
  const a = extractPageInfo(unclosed, PAGE);
  assert.ok(a.links.length <= MAX_ANCHORS);
  const noEnd = "<a ".repeat(500_000); // tags that never end
  extractPageInfo(noEnd, PAGE);
  const bigAttr = `<a href="https://x.com/" title="${"x".repeat(100_000)}">t</a>`;
  extractPageInfo(bigAttr, PAGE);
  assert.ok(Date.now() - started < 4000, `took ${Date.now() - started} ms`);
});

test("extractPageInfo: long visible text is capped and control characters removed", () => {
  const info = extractPageInfo(`<a href="https://me.com/">${"word ".repeat(200)}\u0000\u0007</a>`, PAGE);
  assert.ok(info.links[0].text.length <= 200);
  assert.ok(!/[\u0000-\u001f]/.test(info.links[0].text));
  assert.ok(info.links[0].snippet.length <= 500);
});
