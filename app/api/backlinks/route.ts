import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBacklinkUser } from "@/lib/backlinks/auth";
import { addBacklink } from "@/lib/backlinks/service";
import { readJson } from "@/lib/links/http";

const schema = z.object({
  source_url: z.string().max(2048),
  target_url: z.string().max(2048),
  anchor_text: z.string().max(500).nullish(),
  note: z.string().max(1000).nullish(),
  project_id: z.string().uuid().nullish(),
});

export async function POST(request: Request) {
  const gate = await requireBacklinkUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 20_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const res = await addBacklink(gate.ctx, { ...parsed.data, project_id: parsed.data.project_id ?? null });
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ backlink: res.data }, { status: 201 });
}
