import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { updateShortLink, deleteShortLink } from "@/lib/links/service";
import { readJson } from "@/lib/links/http";

const UUID = z.string().uuid();

const updateSchema = z.object({
  destination_url: z.string().max(2048).optional(),
  title: z.string().max(300).nullish(),
  folder: z.string().max(100).nullish(),
  tags: z.union([z.array(z.string().max(60)).max(30), z.string().max(500)]).nullish(),
  expires_at: z.string().max(40).nullish(),
  max_clicks: z.number().int().nullish(),
  password: z.string().max(200).nullish(),
  clear_password: z.boolean().optional(),
  is_active: z.boolean().optional(),
  project_id: z.string().uuid().nullish(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;

  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });

  const res = await updateShortLink(gate.ctx, id, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ link: res.data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;

  const res = await deleteShortLink(gate.ctx, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
