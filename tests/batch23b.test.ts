import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideRecheck, buildDomainRecheckEmail, MISSES_BEFORE_PENDING, DOMAIN_RECHECK_TASK } from "@/lib/domains/recheck";
import { buildProjectNoticeEmail, PROJECT_PAUSED_MESSAGE } from "@/lib/projects/suspension";
import { buildApiKeyRevokedEmail } from "@/lib/api/admin-notice";
import { validateSetting } from "@/lib/setting-rules";
import { toolById } from "@/lib/features/registry";
import { USER_HELP } from "@/lib/help/user-help";

const read = (f: string) => readFileSync(f, "utf8");
const FOUND = { ok: true } as const;
const NOT_FOUND = { ok: false, reason: "not_found" } as const;
const MISMATCH = { ok: false, reason: "mismatch" } as const;
const DNS_ERROR = { ok: false, reason: "dns_error" } as const;

// ---- custom domains: daily ownership re-check ----
test("domain re-check: the TXT record present = pass and the counter resets", () => {
  assert.deepEqual(decideRecheck({ failures: 2, txt: FOUND, pointing: false }), { outcome: "ok", failures: 0, action: "none" });
});

test("domain re-check: a deleted TXT record is fine while the domain still points to us (owners were never told to keep it)", () => {
  assert.deepEqual(decideRecheck({ failures: 1, txt: NOT_FOUND, pointing: true }), { outcome: "ok", failures: 0, action: "none" });
  assert.deepEqual(decideRecheck({ failures: 0, txt: MISMATCH, pointing: true }), { outcome: "ok", failures: 0, action: "none" });
});

test("domain re-check: a failed DNS lookup is never held against the owner", () => {
  assert.deepEqual(decideRecheck({ failures: 2, txt: DNS_ERROR, pointing: false }), { outcome: "unknown", failures: 2, action: "none" });
  assert.deepEqual(decideRecheck({ failures: 0, txt: DNS_ERROR, pointing: true }), { outcome: "unknown", failures: 0, action: "none" });
});

test("domain re-check: warn at the first miss, go back to pending at the third", () => {
  assert.equal(MISSES_BEFORE_PENDING, 3);
  assert.deepEqual(decideRecheck({ failures: 0, txt: NOT_FOUND, pointing: false }), { outcome: "miss", failures: 1, action: "warn" });
  assert.deepEqual(decideRecheck({ failures: 1, txt: MISMATCH, pointing: false }), { outcome: "miss", failures: 2, action: "none" });
  assert.deepEqual(decideRecheck({ failures: 2, txt: NOT_FOUND, pointing: false }), { outcome: "miss", failures: 3, action: "downgrade" });
  assert.equal(decideRecheck({ failures: 9, txt: NOT_FOUND, pointing: false }).action, "downgrade", "a stuck counter still ends in pending");
  assert.equal(decideRecheck({ failures: -4, txt: NOT_FOUND, pointing: false }).failures, 1, "a bad stored counter is treated as zero");
});

test("domain re-check emails: tell the owner exactly which record to keep, and escape the hostname", () => {
  const warn = buildDomainRecheckEmail("warn", { hostname: "go.brand.com", token: "tok123", siteUrl: "https://linklazy.com" });
  assert.ok(warn.subject.includes("go.brand.com"));
  assert.ok(warn.html.includes("_linklazy") || warn.html.includes("go.brand.com"), "names the record");
  assert.ok(warn.html.includes("3 days"));
  assert.ok(warn.html.includes("https://linklazy.com/dashboard/domains"));
  const down = buildDomainRecheckEmail("downgrade", { hostname: "go.brand.com", token: "tok123", siteUrl: "https://linklazy.com" });
  assert.ok(/pending/i.test(down.subject) && down.html.includes("Check again"));
  assert.ok(!buildDomainRecheckEmail("warn", { hostname: "<b>x</b>.com", token: "t", siteUrl: "https://x" }).html.includes("<b>x</b>"));
});

test("domain re-check is wired into the daily run (and the admin run) and skips itself when the SQL or the tool is missing", () => {
  const cron = read("app/api/cron/run-tasks/route.ts");
  assert.ok(cron.includes("enqueueDueDomainRechecks") && cron.includes('import "@/lib/domains/register"') && cron.includes("feature_tool_domains"));
  assert.ok(read("app/api/admin/tasks/run/route.ts").includes('import "@/lib/domains/register"'));
  assert.ok(read("lib/domains/register.ts").includes("registerTaskHandler(DOMAIN_RECHECK_TASK"));
  assert.equal(DOMAIN_RECHECK_TASK, "domain.recheck");
  const code = read("lib/domains/recheck.ts");
  assert.ok(code.includes("sql_071_missing"), "no SQL 071 = a quiet skip, never a crash");
  assert.ok(code.includes('.in("status", ["verified", "active"])'), "only touches verified/active domains");
  assert.ok(/limit:\s*300/.test(cron), "the run limit covers backlink checks and domain checks together");
});

test("domain owners are told to keep the TXT record", () => {
  assert.ok(read("components/domains/domain-manager.tsx").includes("Keep this record in place"));
  assert.ok(USER_HELP["/dashboard/domains"].watch!.join(" ").includes("TXT"));
});

// ---- projects: pause ----
test("project pause: the message and the owner email", () => {
  assert.ok(PROJECT_PAUSED_MESSAGE.includes("paused"));
  const m = buildProjectNoticeEmail("suspend", { name: "My <i>site</i>", note: "Misuse & spam", siteUrl: "https://linklazy.com" });
  assert.ok(!m.html.includes("<i>site</i>") && m.html.includes("Misuse &amp; spam") && m.html.includes("dashboard/support"));
  assert.ok(/active again/i.test(buildProjectNoticeEmail("restore", { name: "A", siteUrl: "https://x" }).subject));
});

test("project pause is enforced where work starts, and a paused project cannot be deleted", () => {
  assert.ok(read("lib/opportunities/server.ts").includes("isProjectSuspended(db, projectId)"));
  assert.ok(read("app/api/content/generate/route.ts").includes("isProjectSuspended"));
  assert.ok(read("lib/backlinks/service.ts").includes("isProjectSuspended"));
  assert.ok(read("lib/backlinks/task.ts").includes("project_paused"));
  assert.ok(read("lib/projects/service.ts").includes("isProjectSuspended(createServiceClient(), id)"));
  // before SQL 071 an error must read as "not paused", so nothing breaks
  const s = read("lib/projects/suspension.ts");
  assert.ok(s.includes("if (error) return false;") && s.includes("catch {"));
});

test("admin project and API-key routes: admin only, validated id, audit log, owner notice", () => {
  for (const f of ["app/api/admin/projects/[id]/route.ts", "app/api/admin/api-keys/[id]/route.ts"]) {
    const s = read(f);
    assert.ok(s.includes("requireAdmin()"), f);
    assert.ok(s.includes("z.string().uuid()"), f);
    assert.ok(s.includes('from("admin_logs").insert'), f);
    assert.ok(/notify(Project|ApiKey)Owner/.test(s), f);
  }
  assert.ok(read("app/api/admin/projects/[id]/route.ts").includes("Run SQL 071 first"));
});

// ---- API keys ----
test("admin API keys page never reads or shows the key hash", () => {
  const page = read("app/admin/api-keys/page.tsx");
  assert.ok(!page.includes("key_hash"), "the hash is never selected");
  assert.ok(page.includes("requireAdmin()") && page.includes("createServiceClient"), "the table has no read policy: the page checks the admin itself");
  const revoke = read("app/api/admin/api-keys/[id]/route.ts");
  assert.ok(!revoke.includes("key_hash") && revoke.includes('.is("revoked_at", null)'));
});

test("API key revoked email names the key by its first characters only", () => {
  const m = buildApiKeyRevokedEmail({ name: "My <script>", prefix: "ll_live_AbCd", note: "Leaked", siteUrl: "https://linklazy.com" });
  assert.ok(m.html.includes("ll_live_AbCd") && m.html.includes("Leaked") && !m.html.includes("<script>"));
});

test("API keys: the admin page is in the menu, on the tool's card and has help text", () => {
  assert.ok(read("app/admin/layout.tsx").includes('"/admin/api-keys"'));
  assert.equal(toolById("api_keys")?.adminHref, "/admin/api-keys");
  const help = read("lib/help/admin-help.ts");
  for (const k of ['"/admin/api-keys"', '"/admin/projects"', '"/admin/domains"']) assert.ok(help.includes(k), k);
});

// ---- SQL ----
test("SQL 071 only adds: no drop, delete, truncate or update outside comments", () => {
  const sql = read("supabase/sql/071_batch23b_projects_domains.sql").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  // "on delete set null" belongs to the new foreign key (it cannot remove anything); every other drop/delete/truncate/update is refused.
  assert.ok(!/\b(drop|delete|truncate|update)\b/i.test(sql.replace(/on delete set null/gi, "")));
  for (const c of ["suspended_at", "suspended_reason", "suspended_by", "recheck_failures", "last_recheck_at"]) assert.ok(sql.includes(c), c);
  assert.ok(read("supabase/sql/072_batch23b_verify.sql").includes("select table_name, column_name"));
});

// ---- exchange rate setting ----
test("exchange rate setting: only a sensible plain number is saved", () => {
  assert.deepEqual(validateSetting("bdt_per_usd", "125"), { ok: true, value: "125" });
  assert.deepEqual(validateSetting("bdt_per_usd", " 124.5 "), { ok: true, value: "124.5" });
  assert.deepEqual(validateSetting("bdt_per_usd", 130), { ok: true, value: "130" });
  for (const bad of ["", "abc", "125 BDT", "1,25", "-5", "0", "49", "501", "0.125", "1250", "12.345", null, undefined, {}]) {
    assert.equal(validateSetting("bdt_per_usd", bad).ok, false, String(bad));
  }
  assert.deepEqual(validateSetting("contact_email", "a@b.c"), { ok: true, value: "a@b.c" }, "other settings pass through");
  assert.ok(read("app/api/settings/route.ts").includes("validateSetting"));
  assert.ok(read("app/admin/settings/page.tsx").includes("saveError"), "the form shows the reason a save is refused");
});
