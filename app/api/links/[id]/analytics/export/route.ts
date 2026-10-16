import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { parseAnalytics } from "@/lib/analytics/format";
import { analyticsToCsv } from "@/lib/analytics/csv";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;

  const days = [7, 30, 90, 365].includes(Number(new URL(request.url).searchParams.get("days"))) ? Number(new URL(request.url).searchParams.get("days")) : 30;
  // The SQL function returns NULL unless the caller owns the link (or is an admin).
  const { data, error } = await gate.ctx.supabase.rpc("link_analytics", { p_link_id: id, p_days: days });
  const analytics = error ? null : parseAnalytics(data);
  if (!analytics) return NextResponse.json({ error: "Link not found." }, { status: 404 });

  return new NextResponse(analyticsToCsv(analytics), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="linklazy-analytics-${days}d.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
