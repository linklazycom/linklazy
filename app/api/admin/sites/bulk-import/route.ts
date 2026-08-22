import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { siteSubmissionSchema } from "@/lib/validators/site";
import { csvToObjects } from "@/lib/csv";
import { fetchDomainRating } from "@/lib/ahrefs";

// This route loops sequentially over many items with external API/email
// calls per item, which can exceed Vercel's default serverless timeout
// and get killed mid-batch (silent partial completion). Requires a plan
// that supports extended function duration (Vercel Pro or higher).
export const maxDuration = 300;

// Hard cap so a single import request can't run past the serverless
// function timeout or hammer the DB/Ahrefs. Bigger lists should be split
// into a few CSV files — the admin has said 100/batch is the practical
// ceiling they'll actually use.
const MAX_ROWS = 100;

// Gap between per-row Ahrefs DR checks, same spirit as the weekly refresh
// cron's fetchDomainRatingBatch default — keeps us well inside Ahrefs'
// free-endpoint rate limit instead of firing 100 requests back to back.
const DR_CHECK_DELAY_MS = 400;

const requestSchema = z.object({
  csv: z.string().min(1, "CSV content is required"),
});

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  const v = value.trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(v)) return true;
  if (["false", "no", "n", "0"].includes(v)) return false;
  return fallback;
}

// Undefined out any empty-string values so zod's `.optional()` numeric
// coercion doesn't choke on "" (z.coerce.number() turns "" into NaN, not
// undefined).
function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

// Same normalization Ahrefs lookups use (lib/ahrefs.ts's extractHostname,
// not exported from there) — strips protocol, "www.", and path/query, so
// https://Example.com/, http://www.example.com, and example.com all
// collapse to the same key for duplicate detection.
function normalizeHost(input: string): string {
  try {
    const url = input.includes("://") ? input : `https://${input}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return input
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .toLowerCase();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RowResult {
  row: number;
  url: string | null;
  owner_email: string | null;
  status: "created" | "error";
  site_id?: string;
  dr_checked?: number | null;
  error?: string;
}

/**
 * Bulk site listing from a CSV upload. Mirrors the single-site "List a
 * site (admin)" flow (POST /api/admin/sites/assign) row by row: each row
 * must resolve to an existing account (matched by owner_email), goes
 * straight to status="approved" + verified (same as the manual admin
 * listing form), and gets logged the same way. We do NOT create new
 * accounts here — a bad/unknown email just fails that row with a clear
 * reason, so admins can't accidentally spray sites onto typo'd addresses.
 *
 * Before touching the DB we also reject duplicate URLs — both against
 * sites already listed on the platform, and duplicates within the CSV
 * itself — so a bad file fails fast with a clear per-row reason instead
 * of half-importing and half-hitting a DB constraint error.
 *
 * After a row is inserted we do the same best-effort Ahrefs DR check the
 * single-site admin form does, with a small delay between calls to stay
 * inside Ahrefs' free-endpoint rate limit.
 *
 * Expected CSV headers (case-insensitive, extra columns are ignored):
 * owner_email, url, niche, language, da, pa, dr, organic_traffic,
 * referring_domains, total_backlinks, indexed_pages, post_count,
 * spam_score, accepts_exchange, accepts_paid, price_amount, link_type,
 * placement, turnaround_hours, guidelines
 */
export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  }
  const { adminId, supabase } = check;

  const body = await request.json().catch(() => null);
  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Send { csv: string } with the file contents." }, { status: 400 });
  }

  const { rows } = csvToObjects(parsedBody.data.csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows found in this CSV." }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `This CSV has ${rows.length} rows — please split it into batches of ${MAX_ROWS} or fewer.` },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // Build an email -> account map once, same approach as the account
  // search endpoint, instead of one Supabase auth lookup per row.
  const emailToId = new Map<string, { id: string; full_name: string | null }>();
  {
    const { data: profiles } = await serviceClient.from("profiles").select("id, full_name");
    const idToName = new Map((profiles ?? []).map((p) => [p.id, p.full_name] as const));

    let page = 1;
    while (true) {
      const { data, error: listError } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError || !data?.users?.length) break;
      data.users.forEach((u) => {
        if (u.email) {
          emailToId.set(u.email.trim().toLowerCase(), {
            id: u.id,
            full_name: idToName.get(u.id) ?? null,
          });
        }
      });
      if (data.users.length < 1000) break;
      page += 1;
    }
  }

  // Existing domains already listed on the platform, for duplicate
  // detection before we attempt any insert.
  const existingHosts = new Set<string>();
  {
    const { data: existingSites } = await serviceClient.from("sites").select("domain, url");
    (existingSites ?? []).forEach((s) => {
      if (s.domain) existingHosts.add(String(s.domain).toLowerCase());
      if (s.url) existingHosts.add(normalizeHost(s.url));
    });
  }

  const results: RowResult[] = [];
  const seenInBatch = new Set<string>();
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2; // +1 for 0-index, +1 for header row
    const url = clean(raw.url) ?? null;
    const ownerEmail = clean(raw.owner_email)?.toLowerCase() ?? null;

    if (!ownerEmail) {
      results.push({ row: rowNum, url, owner_email: null, status: "error", error: "Missing owner_email" });
      continue;
    }

    const owner = emailToId.get(ownerEmail);
    if (!owner) {
      results.push({
        row: rowNum,
        url,
        owner_email: ownerEmail,
        status: "error",
        error: "No account found with this email — create the account first, then re-import this row.",
      });
      continue;
    }

    if (!url) {
      results.push({ row: rowNum, url, owner_email: ownerEmail, status: "error", error: "Missing url" });
      continue;
    }

    const host = normalizeHost(url);
    if (existingHosts.has(host)) {
      results.push({
        row: rowNum,
        url,
        owner_email: ownerEmail,
        status: "error",
        error: "This URL is already listed on the platform",
      });
      continue;
    }
    if (seenInBatch.has(host)) {
      results.push({
        row: rowNum,
        url,
        owner_email: ownerEmail,
        status: "error",
        error: "Duplicate URL within this CSV — only the first occurrence is imported",
      });
      continue;
    }

    const candidate = {
      url: clean(raw.url),
      niche: clean(raw.niche),
      language: clean(raw.language) ?? "en",
      da: clean(raw.da),
      pa: clean(raw.pa),
      dr: clean(raw.dr),
      organic_traffic: clean(raw.organic_traffic),
      referring_domains: clean(raw.referring_domains),
      total_backlinks: clean(raw.total_backlinks),
      indexed_pages: clean(raw.indexed_pages),
      post_count: clean(raw.post_count),
      spam_score: clean(raw.spam_score),
      accepts_exchange: parseBool(raw.accepts_exchange, true),
      accepts_paid: parseBool(raw.accepts_paid, true),
      price_amount: clean(raw.price_amount),
      link_type: clean(raw.link_type) ?? "dofollow",
      placement: clean(raw.placement) ?? "in_content",
      turnaround_hours: clean(raw.turnaround_hours) ?? "48",
      guidelines: clean(raw.guidelines),
    };

    const parsed = siteSubmissionSchema.safeParse(candidate);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Invalid row";
      results.push({ row: rowNum, url, owner_email: ownerEmail, status: "error", error: firstError });
      continue;
    }

    const { data: site, error } = await serviceClient
      .from("sites")
      .insert({ ...parsed.data, owner_id: owner.id, status: "approved" })
      .select("id")
      .single();

    if (error || !site) {
      results.push({
        row: rowNum,
        url,
        owner_email: ownerEmail,
        status: "error",
        error: error?.message.includes("duplicate") ? "This URL is already listed" : error?.message ?? "Insert failed",
      });
      continue;
    }

    // Reserve this host immediately so a later row in the same file with
    // the same URL (already caught above via seenInBatch, but belt and
    // braces) can't slip past.
    seenInBatch.add(host);
    existingHosts.add(host);

    await serviceClient.from("site_verifications").insert({
      site_id: site.id,
      method: "admin_bulk_import",
      status: "verified",
      verified_at: new Date().toISOString(),
    });

    // Best-effort DR check, same as the single-site admin listing flow —
    // never blocks the row from counting as created if Ahrefs fails or
    // isn't configured.
    let drChecked: number | null = null;
    try {
      const drResult = await fetchDomainRating(parsed.data.url);
      if (drResult.ok && drResult.domainRating != null) {
        drChecked = drResult.domainRating;
        await serviceClient
          .from("sites")
          .update({ dr_verified: drResult.domainRating, dr_verified_at: new Date().toISOString(), dr_check_status: "ok" })
          .eq("id", site.id);
      } else {
        await serviceClient.from("sites").update({ dr_check_status: "failed" }).eq("id", site.id);
      }
    } catch {
      // Weekly cron is the safety net if this best-effort check throws.
    }
    await sleep(DR_CHECK_DELAY_MS);

    // Log per created site (same action + shape as the single-site admin
    // listing flow) rather than one summary row, since every other
    // admin_logs entry in this codebase is tied to a specific target_id.
    await supabase.from("admin_logs").insert({
      admin_id: adminId,
      action: "site_created_and_assigned",
      target_table: "sites",
      target_id: site.id,
      metadata: { domain: parsed.data.url, owner_id: owner.id, owner_name: owner.full_name, via: "bulk_import" },
    });

    results.push({ row: rowNum, url, owner_email: ownerEmail, status: "created", site_id: site.id, dr_checked: drChecked });
    created += 1;
  }

  return NextResponse.json({
    total: rows.length,
    created,
    failed: rows.length - created,
    results,
  });
}

