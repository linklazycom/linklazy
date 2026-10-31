import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CRONS, cronHealth } from "../lib/cron-schedule.ts";

/** Hours between runs for the simple schedules used in vercel.json ("m h * * *" daily, "m h * * d" weekly). */
function intervalOf(schedule: string): number {
  const f = schedule.trim().split(/\s+/);
  return f[4] === "*" ? 24 : 168;
}

test("cron list matches vercel.json exactly (names and intervals)", () => {
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
  const fromVercel = new Map(vercel.crons.map((c) => [c.path.replace("/api/cron/", ""), intervalOf(c.schedule)]));
  const scheduled = CRONS.filter((c) => c.scheduled);
  assert.equal(scheduled.length, fromVercel.size);
  for (const c of scheduled) assert.equal(fromVercel.get(c.name), c.intervalHours, c.name);
  assert.ok(!CRONS.filter((c) => !c.scheduled).some((c) => fromVercel.has(c.name)));
});

test("cron routes are all wrapped with trackCron", () => {
  for (const c of CRONS) {
    const src = readFileSync(new URL(`../app/api/cron/${c.name}/route.ts`, import.meta.url), "utf8");
    assert.match(src, new RegExp(`trackCron\\("${c.name}"`), c.name);
  }
});

const now = new Date("2026-11-02T12:00:00Z");
const def = CRONS.find((c) => c.name === "link-checker")!;

test("cron health: ok, late, failing, never, external", () => {
  const row = (over: object) => ({ name: "link-checker", last_finished_at: "2026-11-02T04:05:00Z", last_ok_at: "2026-11-02T04:05:00Z", last_status: "ok", last_http: 200, last_duration_ms: 1000, ...over });
  assert.equal(cronHealth([def], [row({})], now)[0].state, "ok");
  assert.equal(cronHealth([def], [row({ last_ok_at: "2026-10-30T04:00:00Z", last_finished_at: "2026-10-30T04:00:00Z" })], now)[0].state, "late");
  assert.equal(cronHealth([def], [row({ last_status: "failed", last_http: 500 })], now)[0].state, "failing");
  assert.equal(cronHealth([def], [], now)[0].state, "never");
  const outreach = CRONS.find((c) => c.name === "outreach-push")!;
  assert.equal(cronHealth([outreach], [], now)[0].state, "external");
});

test("cron health: weekly jobs get a weekly allowance", () => {
  const weekly = CRONS.find((c) => c.name === "dr-refresh")!;
  const r = { name: "dr-refresh", last_finished_at: "2026-10-27T02:10:00Z", last_ok_at: "2026-10-27T02:10:00Z", last_status: "ok", last_http: 200, last_duration_ms: 5 };
  assert.equal(cronHealth([weekly], [r], now)[0].state, "ok"); // 6 days ago is fine
});
