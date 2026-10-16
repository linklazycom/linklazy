import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { updateBioLink, deleteBioLink } from "@/lib/bio/service";
import { readJson } from "@/lib/links/http";

const UUID = z.string().uuid();
const schema = z.object({ title: z.string().max(300).optional(), url: z.string().max(2048).optional(), is_active: z.boolean().optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const { id, linkId } = await params;
  if (!UUID.safeParse(id).success || !UUID.safeParse(linkId).success) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const res = await updateBioLink(gate.ctx, id, linkId, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ link: res.data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const { id, linkId } = await params;
  if (!UUID.safeParse(id).success || !UUID.safeParse(linkId).success) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const res = await deleteBioLink(gate.ctx, id, linkId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
