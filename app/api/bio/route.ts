import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { createBioPage } from "@/lib/bio/service";
import { readJson } from "@/lib/links/http";

const schema = z.object({ slug: z.string().max(60), display_name: z.string().max(200) });

export async function POST(request: Request) {
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const res = await createBioPage(gate.ctx, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ page: res.data }, { status: 201 });
}
