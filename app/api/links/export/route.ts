import { NextResponse } from "next/server";
import { requireLinkUser } from "@/lib/links/auth";
import { toCsv, EXPORT_HEADERS } from "@/lib/links/csv";
import { linkStatus } from "@/lib/links/rules";
import { shortUrlFor } from "@/lib/links/server";

export async function GET() {
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;

  const { data, error } = await gate.ctx.supabase
    .from("short_links")
    .select("slug, destination_url, title, folder, tags, is_active, expires_at, max_clicks, click_count, disabled_reason, created_at")
    .eq("user_id", gate.ctx.userId)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ error: "Could not export your links." }, { status: 500 });

  const rows = (data ?? []).map((l) => [
    l.slug,
    shortUrlFor(l.slug),
    l.destination_url,
    l.title,
    l.folder,
    (l.tags ?? []).join("|"),
    linkStatus(l),
    l.click_count,
    l.max_clicks,
    l.expires_at,
    l.created_at,
  ]);

  return new NextResponse(toCsv(EXPORT_HEADERS, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="linklazy-links.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
