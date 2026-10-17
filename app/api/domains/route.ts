import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { readJson } from "@/lib/links/http";
import { addDomain } from "@/lib/domains/service";

const schema = z.object({ hostname: z.string().max(300) });

export async function POST(request: Request) {
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 5_000));
  if (!parsed.success) return NextResponse.json({ error: "Enter a domain name." }, { status: 400 });

  const res = await addDomain(gate.ctx.userId, gate.ctx.isAdmin, parsed.data.hostname);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ domain: res.data }, { status: 201 });
}
