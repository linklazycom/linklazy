import { NextResponse } from "next/server";
import { requireProjectUser } from "@/lib/projects/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { isUuid, validateOppPatch } from "@/lib/opportunities/rules";

/** Changes the status and/or note of one of the user's opportunities. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await readJson(request, 10_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const v = validateOppPatch(body as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (v.value.status !== undefined) update.status = v.value.status;
  if (v.value.note !== undefined) update.note = v.value.note;
  const { data, error } = await createServiceClient().from("opportunities").update(update).eq("id", id).eq("user_id", gate.ctx.userId).select("id");
  if (error) return NextResponse.json({ error: "Could not save the change." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data, error } = await createServiceClient().from("opportunities").delete().eq("id", id).eq("user_id", gate.ctx.userId).select("id");
  if (error) return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
