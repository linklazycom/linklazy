import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { extractSlug } from "@/lib/links/slug";
import { cleanText } from "@/lib/links/fields";
import { readJson } from "@/lib/links/http";
import { REPORT_REASONS } from "@/lib/links/blocklist";

const schema = z.object({
  link: z.string().max(500),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(2000).nullish(),
  email: z.string().email().max(200).nullish().or(z.literal("")),
  website: z.string().max(200).nullish(), // honeypot: real people leave it empty
});

/** Public abuse-report endpoint. No login needed, so it is rate-limited per IP and uses the service client server-side. */
export async function POST(request: Request) {
  const { allowed } = await checkRateLimit("link_report", getRequestIp(request), { max: 5, windowMinutes: 60 });
  if (!allowed) return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });

  const parsed = schema.safeParse(await readJson(request, 20_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true }); // bot: pretend success, store nothing

  const slug = extractSlug(parsed.data.link);
  if (!slug) return NextResponse.json({ error: "Enter the short link or its slug (e.g. linklazy.com/l/abc123)." }, { status: 400 });

  const svc = createServiceClient();
  const { data: link } = await svc.from("short_links").select("id").eq("slug", slug).maybeSingle();
  if (!link) return NextResponse.json({ error: "We couldn't find that short link." }, { status: 404 });

  const { error } = await svc.from("link_reports").insert({
    link_id: link.id,
    slug,
    reason: parsed.data.reason,
    details: cleanText(parsed.data.details, 2000),
    reporter_email: parsed.data.email || null,
  });
  if (error) return NextResponse.json({ error: "Could not submit the report. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
