import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { updateBioPage, deleteBioPage } from "@/lib/bio/service";
import { readJson } from "@/lib/links/http";

const UUID = z.string().uuid();
const schema = z.object({
  display_name: z.string().max(200).optional(),
  bio: z.string().max(2000).nullish(),
  avatar_url: z.string().max(1000).nullish(),
  theme: z.string().max(30).optional(),
  is_published: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 20_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const res = await updateBioPage(gate.ctx, id, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ page: res.data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;
  const res = await deleteBioPage(gate.ctx, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
