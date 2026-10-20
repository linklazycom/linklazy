import { isUuid } from "@/lib/content/documents";
import { maskDomain } from "@/lib/mask-domain";
import { normalizeCountry } from "@/lib/outreach/regions";
import { cleanTags, isContactSource } from "@/lib/outreach/rules";
import { isSaleshandyId } from "@/lib/outreach/saleshandy";
import { cleanLine } from "@/lib/projects/rules";

/** Outreach campaign rules (Batch 16B-2). Pure. */
export const HARD_DAILY_LIMIT = 200;
export const MAX_PER_RUN = 100;
export const DAILY_CAP_CHOICES = [20, 35, 50, 75, 100] as const;
export const MAX_LISTINGS = 20;

/** Automatic pause: if more than 3% of what was sent in the last 14 days bounced (needs at least 30 sent to judge). */
export const BOUNCE_PAUSE_RATE = 0.03;
export const BOUNCE_MIN_SAMPLE = 30;

export interface CampaignInput {
  name: string;
  sequence_id: string;
  sequence_name: string | null;
  step_id: string;
  daily_cap: number;
  filter_tag: string | null;
  filter_country: string | null;
  filter_source: string | null;
  site_ids: string[];
}

type Fail = { ok: false; message: string; field?: string };

export function validateCampaign(input: Record<string, unknown>): { ok: true; value: CampaignInput } | Fail {
  const name = cleanLine(input.name, 80);
  if (!name) return { ok: false, message: "Give the campaign a name.", field: "name" };
  const sequenceId = typeof input.sequence_id === "string" ? input.sequence_id.trim() : "";
  if (!isSaleshandyId(sequenceId) && !/^[0-9]{1,20}$/.test(sequenceId)) return { ok: false, message: "Enter the Saleshandy sequence id (pick it from the list or copy it from Saleshandy).", field: "sequence_id" };
  const stepId = typeof input.step_id === "string" ? input.step_id.trim() : "";
  if (!isSaleshandyId(stepId)) return { ok: false, message: "Enter the id of the sequence step that new prospects should start at.", field: "step_id" };

  const cap = Number(input.daily_cap);
  if (!Number.isInteger(cap) || cap < 1 || cap > HARD_DAILY_LIMIT) return { ok: false, message: `Daily limit must be a whole number from 1 to ${HARD_DAILY_LIMIT}.`, field: "daily_cap" };

  let filterCountry: string | null = null;
  if (typeof input.filter_country === "string" && input.filter_country.trim()) {
    filterCountry = normalizeCountry(input.filter_country);
    if (!filterCountry) return { ok: false, message: "Use a 2-letter country code such as US.", field: "filter_country" };
  }
  let filterSource: string | null = null;
  if (typeof input.filter_source === "string" && input.filter_source.trim()) {
    if (!isContactSource(input.filter_source)) return { ok: false, message: "Unknown source.", field: "filter_source" };
    filterSource = input.filter_source;
  }
  const tags = cleanTags(input.filter_tag);

  const rawSites = Array.isArray(input.site_ids) ? input.site_ids : [];
  const siteIds: string[] = [];
  for (const s of rawSites) {
    if (!isUuid(s)) return { ok: false, message: "Invalid listing.", field: "site_ids" };
    if (!siteIds.includes(s)) siteIds.push(s);
  }
  if (siteIds.length > MAX_LISTINGS) return { ok: false, message: `Choose at most ${MAX_LISTINGS} listings.`, field: "site_ids" };

  return {
    ok: true,
    value: {
      name,
      sequence_id: sequenceId,
      sequence_name: cleanLine(input.sequence_name, 120),
      step_id: stepId,
      daily_cap: cap,
      filter_tag: tags[0] ?? null,
      filter_country: filterCountry,
      filter_source: filterSource,
      site_ids: siteIds,
    },
  };
}

export interface CampaignPatch {
  name?: string;
  daily_cap?: number;
  status?: "active" | "paused";
}

export function validateCampaignPatch(input: Record<string, unknown>): { ok: true; value: CampaignPatch } | Fail {
  const out: CampaignPatch = {};
  if (input.name !== undefined) {
    const n = cleanLine(input.name, 80);
    if (!n) return { ok: false, message: "Give the campaign a name.", field: "name" };
    out.name = n;
  }
  if (input.daily_cap !== undefined) {
    const cap = Number(input.daily_cap);
    if (!Number.isInteger(cap) || cap < 1 || cap > HARD_DAILY_LIMIT) return { ok: false, message: `Daily limit must be a whole number from 1 to ${HARD_DAILY_LIMIT}.`, field: "daily_cap" };
    out.daily_cap = cap;
  }
  if (input.status !== undefined) {
    if (input.status !== "active" && input.status !== "paused") return { ok: false, message: "Invalid status.", field: "status" };
    out.status = input.status;
  }
  if (Object.keys(out).length === 0) return { ok: false, message: "Nothing to change." };
  return { ok: true, value: out };
}

/** How many contacts may be handed to Saleshandy now: the campaign's daily limit, the global ceiling and a per-run cap. */
export function planPushQuota(input: { dailyCap: number; campaignToday: number; allToday: number }): number {
  const left = Math.min(input.dailyCap - input.campaignToday, HARD_DAILY_LIMIT - input.allToday, MAX_PER_RUN);
  return Math.max(0, Math.floor(left));
}

/** Round-robin over the chosen listings. Returns one site id per contact (null when no listings were chosen). */
export function assignListings(count: number, siteIds: string[], startIndex: number): { assigned: (string | null)[]; nextIndex: number } {
  if (siteIds.length === 0) return { assigned: Array.from({ length: count }, () => null), nextIndex: 0 };
  const assigned: (string | null)[] = [];
  let i = Math.max(0, Math.floor(startIndex)) % siteIds.length;
  for (let n = 0; n < count; n++) {
    assigned.push(siteIds[i]);
    i = (i + 1) % siteIds.length;
  }
  return { assigned, nextIndex: i };
}

export function shouldAutoPause(sent: number, bounced: number): { pause: boolean; rate: number } {
  const rate = sent > 0 ? bounced / sent : 0;
  return { pause: sent >= BOUNCE_MIN_SAMPLE && rate > BOUNCE_PAUSE_RATE, rate };
}

export interface ListingSite {
  domain: string;
  niche: string | null;
  da: number | null;
  dr: number | null;
  organic_traffic: number | null;
  /** Stored in BDT. */
  price_amount: number | null;
}

export function formatTraffic(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

export const formatUsd = (bdt: number, bdtPerUsd: number): string => `$${Math.max(1, Math.round(bdt / bdtPerUsd))}`;

/**
 * What the email says about a listing. The real domain stays MASKED, as it is for any buyer who has not unlocked the
 * site, so a cold email never reveals a seller's domain. The link goes to the public niche page.
 */
export function buildListingFields(site: ListingSite, ctx: { bdtPerUsd: number; siteUrl: string }) {
  const niche = site.niche?.trim() || "";
  const bits: string[] = [];
  if (site.dr) bits.push(`DR ${site.dr}`);
  if (site.da) bits.push(`DA ${site.da}`);
  if (site.organic_traffic) bits.push(`${formatTraffic(site.organic_traffic)} organic visits/month`);
  const base = ctx.siteUrl.replace(/\/+$/, "");
  return {
    listingName: niche ? `${maskDomain(site.domain)} (${niche})` : maskDomain(site.domain),
    listingPrice: site.price_amount && site.price_amount > 0 ? formatUsd(site.price_amount, ctx.bdtPerUsd) : "",
    listingUrl: niche ? `${base}/niches/${encodeURIComponent(niche.toLowerCase())}` : `${base}/browse`,
    listingMetrics: bits.join(" · "),
  };
}
