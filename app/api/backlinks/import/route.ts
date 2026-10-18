import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBacklinkUser } from "@/lib/backlinks/auth";
import { importBacklinks } from "@/lib/backlinks/service";
import { IMPORT_MAX_ROWS, parseBacklinkCsv } from "@/lib/backlinks/rules";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/links/http";

export const maxDuration = 60;

const schema = z.object({ csv: z.string().max(500_000), project_id: z.string().uuid().nullish() });

export async function POST(request: Request) {
  const gate = await requireBacklinkUser();
  if ("error" in gate) return gate.error;

  const parsed = schema.safeParse(await readJson(request, 600_000));
  if (!parsed.success) return NextResponse.json({ error: "Upload a CSV file." }, { status: 400 });

  const rows = parseBacklinkCsv(parsed.data.csv, IMPORT_MAX_ROWS);
  if (!rows.ok) return NextResponse.json({ error: rows.error }, { status: 400 });

  if (!gate.ctx.isAdmin) {
    const { allowed } = await checkRateLimit("backlink_import", gate.ctx.userId, { max: 5, windowMinutes: 60 });
    if (!allowed) return NextResponse.json({ error: "Too many imports. Please try again later." }, { status: 429 });
  }

  const res = await importBacklinks(gate.ctx, rows.rows, parsed.data.project_id ?? null);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ added: res.data.filter((r) => r.ok).length, failed: res.data.filter((r) => !r.ok).length, results: res.data });
}
