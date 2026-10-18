import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBacklinkUser } from "@/lib/backlinks/auth";
import { deleteBacklink, updateBacklink } from "@/lib/backlinks/service";
import { readJson } from "@/lib/links/http";

const UUID = z.string().uuid();
const schema = z.object({
  project_id: z.string().uuid().nullable().optional(),
  anchor_text: z.string().max(500).nullish(),
  note: z.string().max(1000).nullish(),
  monitoring: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Backlink not found." }, { status: 404 });
  const gate = await requireBacklinkUser();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await readJson(request, 20_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const res = await updateBacklink(gate.ctx, id, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ backlink: res.data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Backlink not found." }, { status: 404 });
  const gate = await requireBacklinkUser();
  if ("error" in gate) return gate.error;
  const res = await deleteBacklink(gate.ctx, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
