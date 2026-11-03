import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSearchRequest, parseSearchResponse, parseCustomJson, isSearchAdapter, SEARCH_ADAPTER_INFO } from "@/lib/providers/search";
import { OPP_BULK_MAX, validateOppBulk } from "@/lib/opportunities/rules";
import { buildOutreachPrefillHref, outreachGoalFor, parseStudioPrefill } from "@/lib/content/prefill";
import { buildInboxLink, buildReplyNoticeEmail, isNotifyOn, validateInboxTemplate } from "@/lib/outreach/notify";

const read = (f: string) => readFileSync(f, "utf8");
const ID1 = "7d1c0f12-1111-4111-8111-111111111111";
const ID2 = "7d1c0f12-2222-4111-8111-222222222222";

// ---- Brave ----
test("brave: GET to the documented endpoint, key in X-Subscription-Token (never a Bearer token)", () => {
  const r = buildSearchRequest({ adapter: "brave", baseUrl: null, apiKey: "KEY123", engineId: null, query: "guest post  seo", maxResults: 8 });
  assert.equal(r.method, "GET");
  assert.ok(r.url.startsWith("https://api.search.brave.com/res/v1/web/search?"));
  const u = new URL(r.url);
  assert.equal(u.searchParams.get("q"), "guest post seo");
  assert.equal(u.searchParams.get("count"), "8");
  assert.equal(u.searchParams.get("text_decorations"), "false");
  assert.equal(r.headers["x-subscription-token"], "KEY123");
  assert.equal(r.headers.authorization, undefined, "Brave answers 401 to a Bearer header");
  assert.ok(!r.url.includes("KEY123"), "the key is never put in the address");
  assert.throws(() => buildSearchRequest({ adapter: "brave", baseUrl: null, apiKey: null, engineId: null, query: "x", maxResults: 5 }), /No API key/);
  assert.equal(new URL(buildSearchRequest({ adapter: "brave", baseUrl: null, apiKey: "k", engineId: null, query: "x", maxResults: 99 }).url).searchParams.get("count"), "10", "capped by our own maximum");
});

test("brave: results come from web.results; tags are stripped; nothing found is an empty list; an error is an error", () => {
  const hits = parseSearchResponse("brave", {
    web: { results: [
      { title: "A <strong>guide</strong>", url: "https://a.example/x", description: "About <strong>seo</strong> tips", page_age: "2025-04-12T14:22:10" },
      { title: "No address", description: "dropped" },
      { title: "Bad", url: "javascript:alert(1)" },
      { title: "B", url: "https://b.example/", description: "plain" },
    ] },
  });
  assert.equal(hits.length, 2);
  assert.equal(hits[0].title, "A guide");
  assert.equal(hits[0].snippet, "About seo tips");
  assert.ok(hits[0].publishedAt?.startsWith("2025-04-12"));
  assert.equal(hits[1].publishedAt, null);
  assert.deepEqual(parseSearchResponse("brave", { type: "search", query: { original: "x" } }), []);
  assert.throws(() => parseSearchResponse("brave", { type: "ErrorResponse", error: { code: "RATE_LIMITED" } }), /error/);
});

// ---- custom JSON ----
test("custom_json: needs an https address with {query}; the words are URL-encoded; {count} is optional", () => {
  const r = buildSearchRequest({ adapter: "custom_json", baseUrl: "https://s.example.com/api?q={query}&n={count}", apiKey: null, engineId: null, query: "seo & links", maxResults: 7 });
  assert.equal(r.url, "https://s.example.com/api?q=seo%20%26%20links&n=7");
  assert.equal(r.headers.authorization, undefined);
  assert.equal(r.method, "GET");
  const withKey = buildSearchRequest({ adapter: "custom_json", baseUrl: "https://s.example.com/?q={query}", apiKey: "k1", engineId: null, query: "x", maxResults: 5 });
  assert.equal(withKey.headers.authorization, "Bearer k1");
  // the address parser may have written the braces as %7B / %7D: that must still work
  assert.equal(buildSearchRequest({ adapter: "custom_json", baseUrl: "https://s.example.com/%7Bquery%7D/find", apiKey: null, engineId: null, query: "a b", maxResults: 5 }).url, "https://s.example.com/a%20b/find");
  assert.throws(() => buildSearchRequest({ adapter: "custom_json", baseUrl: "http://s.example.com/?q={query}", apiKey: null, engineId: null, query: "x", maxResults: 5 }), /https/);
  assert.throws(() => buildSearchRequest({ adapter: "custom_json", baseUrl: "https://s.example.com/?q=fixed", apiKey: null, engineId: null, query: "x", maxResults: 5 }), /\{query\}/);
  assert.throws(() => buildSearchRequest({ adapter: "custom_json", baseUrl: null, apiKey: null, engineId: null, query: "x", maxResults: 5 }), /https/);
});

test("custom_json: finds the list under the usual names and reads the usual field names", () => {
  const item = { link: "https://a.example/p", name: "A <b>page</b>", summary: "text", date: "2025-01-02" };
  for (const shape of [[item], { results: [item] }, { items: [item] }, { data: [item] }, { hits: [item] }, { organic: [item] }]) {
    const h = parseCustomJson(shape);
    assert.equal(h.length, 1);
    assert.deepEqual([h[0].url, h[0].title, h[0].snippet], ["https://a.example/p", "A page", "text"]);
    assert.ok(h[0].publishedAt?.startsWith("2025-01-02"));
  }
  assert.deepEqual(parseCustomJson({ results: [{ title: "no address" }, { url: "ftp://x" }] }), [], "a list with nothing usable is empty, not an error");
  assert.throws(() => parseCustomJson({ message: "hello" }), /no results list/);
  assert.equal(parseSearchResponse("custom_json", { results: [item, item, item] }, 2).length, 2, "respects the limit");
});

test("the two new search types are known and need the right fields", () => {
  assert.ok(isSearchAdapter("brave") && isSearchAdapter("custom_json") && !isSearchAdapter("bing"));
  assert.deepEqual([SEARCH_ADAPTER_INFO.brave.needsKey, SEARCH_ADAPTER_INFO.brave.needsBaseUrl], [true, false]);
  assert.deepEqual([SEARCH_ADAPTER_INFO.custom_json.needsKey, SEARCH_ADAPTER_INFO.custom_json.needsBaseUrl], [false, true]);
  assert.ok(read("components/admin/api-providers-manager.tsx").includes('form.adapter === "custom_json"'));
});

// ---- Opportunity bulk status ----
test("opportunity bulk: one valid status and 1 to 100 distinct valid ids", () => {
  assert.deepEqual(validateOppBulk({ ids: [ID1, ID2, ID1.toUpperCase()], status: "contacted" }), { ok: true, ids: [ID1, ID2], status: "contacted" });
  assert.equal(validateOppBulk({ ids: [ID1], status: "new" }).ok, true);
  for (const bad of [{ ids: [], status: "done" }, { ids: ["x", 5, null], status: "done" }, { ids: [ID1], status: "deleted" }, { ids: ID1, status: "done" }, { status: "done" }, { ids: [ID1] }]) {
    assert.equal(validateOppBulk(bad as Record<string, unknown>).ok, false, JSON.stringify(bad));
  }
  const many = Array.from({ length: OPP_BULK_MAX + 1 }, (_, i) => `7d1c0f12-0000-4111-8111-${String(i).padStart(12, "0")}`);
  assert.equal(validateOppBulk({ ids: many, status: "saved" }).ok, false);
  assert.equal(validateOppBulk({ ids: many.slice(0, OPP_BULK_MAX), status: "saved" }).ok, true);
});

test("opportunity bulk route only changes the signed-in user's own rows", () => {
  const route = read("app/api/opportunities/bulk/route.ts");
  assert.ok(route.includes("requireProjectUser()") && route.includes('.eq("user_id", gate.ctx.userId)') && route.includes('.in("id", v.ids)'));
  const page = read("app/(dashboard)/dashboard/opportunities/page.tsx");
  assert.ok(page.includes("<BulkProvider>") && page.includes("<SelectBox") && page.includes("<BulkBar"));
});

// ---- Opportunity -> outreach email draft ----
test("outreach draft: only guest-post and resource-page results get the button", () => {
  assert.equal(outreachGoalFor("guest_post"), "guest post pitch");
  assert.equal(outreachGoalFor("resource_page"), "resource page suggestion");
  for (const t of ["directory", "profile", "comment", "", "x"]) assert.equal(outreachGoalFor(t), null);
  assert.equal(buildOutreachPrefillHref({ projectId: ID1, projectName: "P", oppType: "directory", domain: "d.com", title: "t", url: "https://d.com" }), null);
  assert.equal(buildOutreachPrefillHref({ projectId: "not-a-uuid", projectName: "P", oppType: "guest_post", domain: "d.com", title: "t", url: "https://d.com" }), null);
});

test("outreach draft: the address round-trips into a pre-filled form, with the page and project in the pitch", () => {
  const href = buildOutreachPrefillHref({ projectId: ID1, projectName: "My Shop", oppType: "guest_post", domain: "blog.example.com", title: "Write for us & earn", url: "https://blog.example.com/write-for-us" })!;
  assert.ok(href.startsWith("/dashboard/content?"));
  const sp = Object.fromEntries(new URL(href, "https://x.test").searchParams.entries());
  const pre = parseStudioPrefill(sp, [ID1])!;
  assert.equal(pre.kind, "outreach_email");
  assert.equal(pre.projectId, ID1);
  assert.equal(pre.values.goal, "guest post pitch");
  assert.equal(pre.values.recipient, "blog.example.com");
  assert.ok(pre.values.pitch.includes("Write for us & earn") && pre.values.pitch.includes("https://blog.example.com/write-for-us") && pre.values.pitch.includes("My Shop"));
});

test("outreach draft: a hand-edited address cannot smuggle in a foreign project, a made-up goal or oversized text", () => {
  const foreign = parseStudioPrefill({ kind: "outreach_email", project: ID2, goal: "guest post pitch" }, [ID1])!;
  assert.equal(foreign.projectId, null, "someone else's project is ignored");
  assert.equal(parseStudioPrefill({ kind: "outreach_email", goal: "send spam", recipient: "" , pitch: ""}, [ID1]), null, "an unknown goal with nothing else is no prefill");
  const big = parseStudioPrefill({ kind: "outreach_email", goal: "partnership idea", recipient: "r".repeat(900), pitch: "p".repeat(9000) }, [ID1])!;
  assert.equal(big.values.recipient.length, 150);
  assert.equal(big.values.pitch.length, 1500);
  assert.equal(parseStudioPrefill({ kind: "bio", goal: "guest post pitch" }, [ID1]), null, "only the outreach email form is pre-filled");
  assert.equal(parseStudioPrefill({}, [ID1]), null);
  const page = read("app/(dashboard)/dashboard/content/page.tsx");
  assert.ok(page.includes("parseStudioPrefill") && page.includes("initialDoc ? null"), "an opened saved document wins over a prefill");
  assert.ok(read("components/content/studio.tsx").includes("prefill?.values"));
});

// ---- reply alerts and the Saleshandy link ----
test("reply alert: ON unless explicitly switched off", () => {
  for (const on of [undefined, null, true, "true", "", 1]) assert.equal(isNotifyOn(on), true, String(on));
  for (const off of [false, "false"]) assert.equal(isNotifyOn(off), false);
});

test("reply alert email: escapes the reply, cuts it short, flags a 'no thanks' and links to the ticket", () => {
  const m = buildReplyNoticeEmail({ email: "a@b.co", subject: "Re: <b>hi</b>", preview: "<script>x</script> " + "y".repeat(900), kind: "no_thanks", ticketId: ID1, siteUrl: "https://linklazy.com" });
  assert.ok(!m.html.includes("<script>") && !m.html.includes("<b>hi</b>"));
  assert.ok(m.html.includes("asked you to stop") && m.html.includes(`https://linklazy.com/admin/outreach/tickets/${ID1}`));
  assert.ok(m.html.length < 2000, "the reply text is cut at 300 characters");
  assert.ok(m.subject.includes("a@b.co"));
  assert.ok(buildReplyNoticeEmail({ email: "a@b.co", kind: "reply", ticketId: ID1, siteUrl: "https://x" }).html.includes("did not include the text"));
});

test("reply alert wiring: sent after the ticket is saved, skips automatic answers, never blocks the webhook", () => {
  const ev = read("lib/outreach/events-server.ts");
  assert.ok(ev.indexOf("notifyAdminOfReply(") > ev.indexOf("Could not record the reply ticket"), "only after the ticket was recorded");
  const n = read("lib/outreach/notify-server.ts");
  assert.ok(n.includes('input.kind === "auto_reply"') && n.includes("catch {") && n.includes("return false"));
});

test("Saleshandy conversation link: a template with {conversation_id} or {email}, https only, filled in safely", () => {
  assert.deepEqual(validateInboxTemplate(""), { ok: true, value: "" });
  assert.deepEqual(validateInboxTemplate(null), { ok: true, value: "" });
  assert.equal(validateInboxTemplate("  https://app.example.com/inbox/{conversation_id}  ").ok, true);
  assert.equal(validateInboxTemplate("https://app.example.com/inbox?q={email}").ok, true);
  for (const bad of ["http://app.example.com/{conversation_id}", "https://app.example.com/inbox", "javascript:alert({conversation_id})", "https://app.example.com/a b/{conversation_id}", "https://" + "x".repeat(600) + "/{conversation_id}", 5, "ftp://x/{email}"]) {
    assert.equal(validateInboxTemplate(bad as unknown).ok, false, String(bad));
  }
  const t = "https://app.example.com/inbox/{conversation_id}?who={email}";
  assert.equal(buildInboxLink(t, { conversationId: "abc/123?x", email: "a+b@c.co" }), "https://app.example.com/inbox/abc%2F123%3Fx?who=a%2Bb%40c.co");
  assert.equal(buildInboxLink(t, { conversationId: null, email: "a@b.co" }), null, "no conversation id: no link");
  assert.equal(buildInboxLink("https://a.example/{email}", { conversationId: null, email: "a@b.co" }), "https://a.example/a%40b.co");
  assert.equal(buildInboxLink("", { conversationId: "x", email: "y" }), null);
  assert.equal(buildInboxLink("not a template", { conversationId: "x", email: "y" }), null);
});

test("reply settings: admin only, validated, saved as two settings; the ticket page shows the link only when it can be built", () => {
  const route = read("app/api/admin/outreach/reply-settings/route.ts");
  assert.ok(route.includes("requireAdmin()") && route.includes("validateInboxTemplate"));
  assert.ok(read("app/admin/outreach/tickets/page.tsx").includes("<ReplySettingsForm"));
  const detail = read("app/admin/outreach/tickets/[id]/page.tsx");
  assert.ok(detail.includes("buildInboxLink") && detail.includes("Open in Saleshandy") && detail.includes('rel="noopener noreferrer nofollow"'));
});
