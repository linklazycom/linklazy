import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { parseImportCsv } from "@/lib/links/csv";
import { importShortLinks } from "@/lib/links/service";
import { getLinkLimits } from "@/lib/links/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/links/http";

const schema = z.object({ csv: z.string().max(500_000) });

export async function POST(request: Request) {
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;

  const parsed = schema.safeParse(await readJson(request, 600_000));
  if (!parsed.success) return NextResponse.json({ error: "Upload a CSV file." }, { status: 400 });

  const limits = await getLinkLimits();
  const rows = parseImportCsv(parsed.data.csv, limits.link_bulk_max_rows);
  if (!rows.ok) return NextResponse.json({ error: rows.error }, { status: 400 });

  if (!gate.ctx.isAdmin) {
    const { allowed } = await checkRateLimit("link_bulk", gate.ctx.userId, { max: 5, windowMinutes: 60 });
    if (!allowed) return NextResponse.json({ error: "Too many imports. Please try again later." }, { status: 429 });
  }

  const results = await importShortLinks(gate.ctx, rows.rows);
  return NextResponse.json({
    created: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
