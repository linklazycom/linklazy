import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { addBioLink, reorderBioLinks } from "@/lib/bio/service";
import { readJson } from "@/lib/links/http";

const UUID = z.string().uuid();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const parsed = z.object({ title: z.string().max(300), url: z.string().max(2048) }).safeParse(await readJson(request, 10_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const res = await addBioLink(gate.ctx, id, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ link: res.data }, { status: 201 });
}

/** PATCH = save a new order: { ids: [...] } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const parsed = z.object({ ids: z.array(z.string().uuid()).max(500) }).safeParse(await readJson(request, 40_000));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const res = await reorderBioLinks(gate.ctx, id, parsed.data.ids);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
