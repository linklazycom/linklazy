import test from "node:test";
import assert from "node:assert/strict";
import { assignListings, buildListingFields, formatTraffic, formatUsd, HARD_DAILY_LIMIT, MAX_PER_RUN, planPushQuota, shouldAutoPause, validateCampaign, validateCampaignPatch } from "@/lib/outreach/campaign";

const SITE_A = "3f2b1c4e-5a6d-4e7f-8a9b-0c1d2e3f4a5b";
const SITE_B = "4a2b1c4e-5a6d-4e7f-8a9b-0c1d2e3f4a5c";
const ok = { name: " Backlink buyers ", sequence_id: "139223", step_id: "FUWcw22do", daily_cap: 20, filter_tag: "VIP, other", filter_country: "us", filter_source: "past_customers", site_ids: [SITE_A, SITE_B, SITE_A] };

test("a valid campaign is cleaned", () => {
  const r = validateCampaign(ok);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.name, "Backlink buyers");
    assert.equal(r.value.filter_tag, "vip");
    assert.equal(r.value.filter_country, "US");
    assert.deepEqual(r.value.site_ids, [SITE_A, SITE_B]);
    assert.equal(r.value.daily_cap, 20);
  }
});

test("bad campaigns are refused with the offending field", () => {
  const field = (o: Record<string, unknown>) => {
    const r = validateCampaign({ ...ok, ...o });
    return r.ok ? null : r.field;
  };
  assert.equal(field({ name: " " }), "name");
  assert.equal(field({ sequence_id: "bad id!" }), "sequence_id");
  assert.equal(field({ step_id: "" }), "step_id");
  assert.equal(field({ daily_cap: 0 }), "daily_cap");
  assert.equal(field({ daily_cap: HARD_DAILY_LIMIT + 1 }), "daily_cap");
  assert.equal(field({ daily_cap: 2.5 }), "daily_cap");
  assert.equal(field({ filter_country: "Germany" }), "filter_country");
  assert.equal(field({ filter_source: "nope" }), "filter_source");
  assert.equal(field({ site_ids: ["123"] }), "site_ids");
  assert.equal(field({ site_ids: Array.from({ length: 21 }, (_, i) => `3f2b1c4e-5a6d-4e7f-8a9b-0c1d2e3f4a${String(i).padStart(2, "0")}`) }), "site_ids");
});

test("edits: status, cap and name", () => {
  assert.ok(validateCampaignPatch({ status: "active", daily_cap: 50 }).ok);
  assert.equal(validateCampaignPatch({ status: "running" }).ok, false);
  assert.equal(validateCampaignPatch({ daily_cap: 1000 }).ok, false);
  assert.equal(validateCampaignPatch({}).ok, false);
});

test("daily quota is the smallest of the campaign cap, the global ceiling and the per-run cap", () => {
  assert.equal(planPushQuota({ dailyCap: 20, campaignToday: 0, allToday: 0 }), 20);
  assert.equal(planPushQuota({ dailyCap: 20, campaignToday: 15, allToday: 15 }), 5);
  assert.equal(planPushQuota({ dailyCap: 20, campaignToday: 20, allToday: 20 }), 0);
  assert.equal(planPushQuota({ dailyCap: 150, campaignToday: 0, allToday: 0 }), MAX_PER_RUN);
  assert.equal(planPushQuota({ dailyCap: 100, campaignToday: 0, allToday: HARD_DAILY_LIMIT - 10 }), 10);
  assert.equal(planPushQuota({ dailyCap: 100, campaignToday: 0, allToday: 500 }), 0);
  assert.equal(planPushQuota({ dailyCap: 20, campaignToday: 30, allToday: 30 }), 0);
});

test("listings rotate round-robin and continue where the last run stopped", () => {
  const a = assignListings(5, [SITE_A, SITE_B], 0);
  assert.deepEqual(a.assigned, [SITE_A, SITE_B, SITE_A, SITE_B, SITE_A]);
  assert.equal(a.nextIndex, 1);
  const b = assignListings(2, [SITE_A, SITE_B], a.nextIndex);
  assert.deepEqual(b.assigned, [SITE_B, SITE_A]);
  assert.deepEqual(assignListings(3, [], 4), { assigned: [null, null, null], nextIndex: 0 });
  assert.deepEqual(assignListings(1, [SITE_A, SITE_B], 7).assigned, [SITE_B]);
});

test("auto-pause needs a real sample and more than 3% bounces", () => {
  assert.equal(shouldAutoPause(10, 5).pause, false); // too few to judge
  assert.equal(shouldAutoPause(100, 3).pause, false); // exactly 3%
  assert.equal(shouldAutoPause(100, 4).pause, true);
  assert.equal(shouldAutoPause(0, 0).pause, false);
  assert.equal(shouldAutoPause(40, 2).rate, 0.05);
});

test("listing text: masked domain, USD price from BDT, public niche link", () => {
  assert.equal(formatUsd(10000, 125), "$80");
  assert.equal(formatUsd(10, 125), "$1");
  assert.equal(formatTraffic(12500), "12.5K");
  assert.equal(formatTraffic(2_000_000), "2M");
  assert.equal(formatTraffic(800), "800");
  const f = buildListingFields({ domain: "example-tech.com", niche: "Technology", da: 45, dr: 52, organic_traffic: 12500, price_amount: 10000 }, { bdtPerUsd: 125, siteUrl: "https://linklazy.com/" });
  assert.ok(!f.listingName.includes("example-tech"));
  assert.ok(f.listingName.endsWith("(Technology)"));
  assert.equal(f.listingPrice, "$80");
  assert.equal(f.listingMetrics, "DR 52 · DA 45 · 12.5K organic visits/month");
  assert.equal(f.listingUrl, "https://linklazy.com/niches/technology");
  const bare = buildListingFields({ domain: "a.io", niche: null, da: null, dr: null, organic_traffic: null, price_amount: null }, { bdtPerUsd: 125, siteUrl: "https://linklazy.com" });
  assert.equal(bare.listingPrice, "");
  assert.equal(bare.listingMetrics, "");
  assert.equal(bare.listingUrl, "https://linklazy.com/browse");
});
