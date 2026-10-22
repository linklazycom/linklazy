import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { decideGate, TOOLS, TOOL_FLAG_KEYS, toolByFlagKey, toolById, toolForPath } from "@/lib/features/registry";
import { ADMIN_HELP, helpForPath } from "@/lib/help/admin-help";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

test("registry: ids and switch keys are unique, texts are filled", () => {
  assert.equal(new Set(TOOLS.map((t) => t.id)).size, TOOLS.length);
  assert.equal(new Set(TOOL_FLAG_KEYS).size, TOOLS.length);
  for (const t of TOOLS) {
    assert.ok(t.label && t.what && t.why && t.whenOff, t.id);
    assert.ok(t.steps.length >= 2 && t.adminNotes.length >= 1, t.id);
    assert.ok(t.pagePrefixes.length >= 1 && t.apiPrefixes.length >= 1, t.id);
    assert.ok(t.pagePrefixes.every((p) => p.startsWith("/dashboard/")) && t.apiPrefixes.every((p) => p.startsWith("/api/")), t.id);
    assert.ok(toolForPath(t.userHref)?.tool.id === t.id, `${t.id}: userHref belongs to its own tool`);
  }
});

test("registry: the four older switches keep their original keys", () => {
  for (const f of FEATURE_FLAGS) assert.ok(toolByFlagKey(f.key), `${f.key} is in the tool list`);
  assert.equal(toolById("content")?.flagKey, "feature_ai_content");
  assert.equal(toolById("opportunities")?.flagKey, "feature_opportunity_finder");
  assert.equal(toolById("backlinks")?.flagKey, "feature_backlink_monitor");
  assert.equal(toolById("links")?.flagKey, "feature_link_management");
});

test("toolForPath: pages and APIs map to their tool; look-alike and public paths do not", () => {
  assert.deepEqual(toolForPath("/dashboard/opportunities"), { tool: toolById("opportunities")!, surface: "page" });
  assert.equal(toolForPath("/dashboard/opportunities/x")?.tool.id, "opportunities");
  assert.deepEqual(toolForPath("/api/opportunities/search"), { tool: toolById("opportunities")!, surface: "api" });
  assert.equal(toolForPath("/dashboard/links")?.tool.id, "links");
  assert.equal(toolForPath("/api/links/export")?.tool.id, "links");
  // must not match by plain string start
  assert.equal(toolForPath("/dashboard/projects-archive"), null);
  assert.equal(toolForPath("/api/projectsx"), null);
  // marketplace essentials, public pages, public API and cron are never gated
  for (const p of ["/dashboard", "/dashboard/orders", "/dashboard/wallet", "/dashboard/unavailable", "/browse", "/l/abc", "/bio/abc", "/api/v1/links", "/api/cron/check-backlinks", "/api/wallet/topup", "/admin/features"]) {
    assert.equal(toolForPath(p), null, p);
  }
});

test("registry: no two tools claim the same path", () => {
  const seen = new Map<string, string>();
  for (const t of TOOLS) for (const p of [...t.pagePrefixes, ...t.apiPrefixes]) {
    assert.ok(!seen.has(p), `${p} claimed by ${seen.get(p)} and ${t.id}`);
    seen.set(p, t.id);
  }
});

test("decideGate: off blocks users but never admins; unknown stays open", () => {
  const off = { feature_tool_bio: false };
  assert.deepEqual(decideGate("/dashboard/bio", "buyer", off), { action: "redirect", to: "/dashboard/unavailable?tool=bio" });
  assert.deepEqual(decideGate("/api/bio/pages", "seller", off), { action: "block" });
  assert.deepEqual(decideGate("/dashboard/bio", "admin", off), { action: "allow" });
  assert.deepEqual(decideGate("/api/bio/pages", "admin", off), { action: "allow" });
  assert.deepEqual(decideGate("/dashboard/bio", "buyer", {}), { action: "allow" }, "missing switch = on");
  assert.deepEqual(decideGate("/dashboard/bio", "buyer", { feature_tool_bio: true }), { action: "allow" });
  assert.deepEqual(decideGate("/dashboard/orders", "buyer", { feature_tool_bio: false }), { action: "allow" });
  assert.deepEqual(decideGate("/dashboard/bio", undefined, off), { action: "redirect", to: "/dashboard/unavailable?tool=bio" });
});

test("admin help: longest prefix wins; every entry is filled and points at a real admin page", () => {
  assert.equal(helpForPath("/admin/outreach/tickets/abc")?.key, "/admin/outreach/tickets");
  assert.equal(helpForPath("/admin/outreach")?.key, "/admin/outreach");
  assert.equal(helpForPath("/admin/links/blocklist")?.key, "/admin/links/blocklist");
  assert.equal(helpForPath("/admin/links")?.key, "/admin/links");
  assert.equal(helpForPath("/admin/orders"), null);
  assert.equal(helpForPath("/admin/featuresx"), null);
  for (const [key, e] of Object.entries(ADMIN_HELP)) {
    assert.ok(e.title && e.what && e.why && e.how.length >= 1, key);
    assert.ok(existsSync(`app${key}/page.tsx`), `${key} has no page`);
  }
});

test("getToolFlags: reads the switches, caches them, and fails open", async () => {
  const { getToolFlags, clearToolFlagCache } = await import("@/lib/features/gate");
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  const realFetch = globalThis.fetch;
  let calls = 0;
  let mode: "ok" | "fail" | "throw" = "ok";
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls++;
    assert.ok(String(url).includes("/rest/v1/site_settings?select=key,value&key=in.(feature_tool_projects,"), "asks only for tool keys");
    if (mode === "throw") throw new Error("network down");
    if (mode === "fail") return new Response("nope", { status: 500 });
    return new Response(JSON.stringify([{ key: "feature_tool_bio", value: "off" }, { key: "feature_ai_content", value: "on" }, { key: "something_else", value: "off" }]), { status: 200 });
  }) as typeof fetch;
  try {
    clearToolFlagCache();
    const flags = await getToolFlags();
    assert.equal(flags.feature_tool_bio, false);
    assert.equal(flags.feature_ai_content, true);
    assert.equal(flags.feature_tool_domains, true, "a tool without a saved row is on");
    assert.equal(flags.something_else, undefined);
    await getToolFlags();
    assert.equal(calls, 1, "second call is served from memory");
    clearToolFlagCache();
    mode = "fail";
    assert.deepEqual(await getToolFlags(), {}, "failure with nothing cached: nothing is blocked");
    mode = "throw";
    assert.deepEqual(await getToolFlags(), {});
    clearToolFlagCache();
    mode = "ok";
    await getToolFlags();
    mode = "throw";
    clearToolFlagCache();
    // a stale copy is not kept after clearing, so this is fail-open again
    assert.deepEqual(await getToolFlags(), {});
  } finally {
    globalThis.fetch = realFetch;
    clearToolFlagCache();
  }
});
