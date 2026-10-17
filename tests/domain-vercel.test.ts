import { test } from "node:test";
import assert from "node:assert/strict";
import { getVercelConfig, addDomain, verifyDomain, getDomainConfig, removeDomain, type FetchLike } from "@/lib/domains/vercel";

const cfg = { token: "tok_secret", projectId: "prj_1", teamId: null as string | null };

function fake(status: number, body: unknown) {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  const f: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { f, calls };
}

test("config needs both token and project; team id is optional", () => {
  assert.equal(getVercelConfig({}), null);
  assert.equal(getVercelConfig({ VERCEL_API_TOKEN: "t" }), null);
  assert.equal(getVercelConfig({ VERCEL_PROJECT_ID: "p" }), null);
  assert.deepEqual(getVercelConfig({ VERCEL_API_TOKEN: " t ", VERCEL_PROJECT_ID: "p" }), { token: "t", projectId: "p", teamId: null });
  assert.equal(getVercelConfig({ VERCEL_API_TOKEN: "t", VERCEL_PROJECT_ID: "p", VERCEL_TEAM_ID: "team_9" })?.teamId, "team_9");
});

test("addDomain posts to the v10 project endpoint with a bearer token and the team id", async () => {
  const { f, calls } = fake(200, { name: "go.brand.com", verified: true });
  const res = await addDomain({ ...cfg, teamId: "team_9" }, "go.brand.com", f);
  assert.equal(res.ok, true);
  assert.equal(calls[0].url, "https://api.vercel.com/v10/projects/prj_1/domains?teamId=team_9");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.Authorization, "Bearer tok_secret");
  assert.deepEqual(JSON.parse(calls[0].body ?? "{}"), { name: "go.brand.com" });
});

test("addDomain: 'already on this project' is success; other-project conflict is an error; the token never leaks into messages", async () => {
  assert.equal((await addDomain(cfg, "a.brand.com", fake(400, { error: { message: "Domain is already assigned to this project" } }).f)).ok, true);
  const conflict = await addDomain(cfg, "a.brand.com", fake(409, { error: { message: "The domain is already assigned to another Vercel project" } }).f);
  assert.equal(conflict.ok, false);
  if (!conflict.ok) {
    assert.equal(conflict.status, 409);
    assert.equal(conflict.message.includes("tok_secret"), false);
  }
});

test("network failure becomes a clean error result, not an exception", async () => {
  const boom: FetchLike = async () => {
    throw new Error("socket hang up tok_secret");
  };
  const res = await addDomain(cfg, "a.brand.com", boom);
  assert.deepEqual(res, { ok: false, status: 0, message: "Could not reach the Vercel API." });
});

test("domain config: misconfigured true/false, and unknown values are treated as misconfigured", async () => {
  const a = await getDomainConfig(cfg, "go.brand.com", fake(200, { misconfigured: false }).f);
  assert.deepEqual(a, { ok: true, data: { misconfigured: false } });
  const b = await getDomainConfig(cfg, "go.brand.com", fake(200, { misconfigured: true }).f);
  assert.deepEqual(b, { ok: true, data: { misconfigured: true } });
  const c = await getDomainConfig(cfg, "go.brand.com", fake(200, {}).f);
  assert.deepEqual(c, { ok: true, data: { misconfigured: true } });
  const { f, calls } = fake(200, { misconfigured: false });
  await getDomainConfig(cfg, "go.brand.com", f);
  assert.equal(calls[0].url, "https://api.vercel.com/v6/domains/go.brand.com/config");
  assert.equal(calls[0].method, "GET");
});

test("verify and remove use the v9 project endpoints; removing a missing domain is fine", async () => {
  const v = fake(200, { verified: true });
  await verifyDomain(cfg, "go.brand.com", v.f);
  assert.equal(v.calls[0].url, "https://api.vercel.com/v9/projects/prj_1/domains/go.brand.com/verify");
  const d = fake(200, {});
  await removeDomain(cfg, "go.brand.com", d.f);
  assert.equal(d.calls[0].url, "https://api.vercel.com/v9/projects/prj_1/domains/go.brand.com");
  assert.equal(d.calls[0].method, "DELETE");
  assert.equal((await removeDomain(cfg, "gone.brand.com", fake(404, { error: { message: "nf" } }).f)).ok, true);
  assert.equal((await removeDomain(cfg, "x.brand.com", fake(500, {}).f)).ok, false);
});
