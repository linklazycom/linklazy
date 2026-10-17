import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyDomainNow } from "@/lib/domains/service";

const UUID = z.string().uuid();

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;

  // DNS lookups and hosting-API calls are not free: allow a check every few seconds, not a flood.
  const { allowed } = await checkRateLimit("domain_verify", gate.ctx.userId, { max: 20, windowMinutes: 10 });
  if (!allowed) return NextResponse.json({ error: "Too many checks. Please wait a few minutes and try again." }, { status: 429 });

  const res = await verifyDomainNow(gate.ctx.userId, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ domain: res.data });
}
