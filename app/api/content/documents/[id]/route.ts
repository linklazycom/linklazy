import { NextResponse } from "next/server";
import { requireProjectUser } from "@/lib/projects/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { isUuid, validateDocumentPatch } from "@/lib/content/documents";

/** Someone else's (or a missing) document is always a plain 404: its existence is never revealed. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await readJson(request, 120_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const v = validateDocumentPatch(body as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const { data, error } = await createServiceClient()
    .from("content_documents")
    .update({ ...v.value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", gate.ctx.userId)
    .select("id");
  if (error) return NextResponse.json({ error: "Could not save the document." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data, error } = await createServiceClient().from("content_documents").delete().eq("id", id).eq("user_id", gate.ctx.userId).select("id");
  if (error) return NextResponse.json({ error: "Could not delete the document." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
