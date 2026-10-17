import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { readJson } from "@/lib/links/http";
import { removeDomain, updateDomainRoot } from "@/lib/domains/service";

const UUID = z.string().uuid();
const patchSchema = z.object({ root_redirect_url: z.string().max(2048).nullable() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const parsed = patchSchema.safeParse(await readJson(request, 5_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });

  const res = await updateDomainRoot(gate.ctx.userId, id, parsed.data.root_redirect_url);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ domain: res.data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const res = await removeDomain(gate.ctx.userId, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
