import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectUser } from "@/lib/projects/auth";
import { updateProject, deleteProject } from "@/lib/projects/service";
import { readJson } from "@/lib/links/http";
import { projectBodySchema } from "@/lib/projects/schema";

const UUID = z.string().uuid();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const parsed = projectBodySchema.safeParse(await readJson(request, 100_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  // null for the free-text fields means "clear it"; null for keywords/competitors means "clear the list".
  const body = { ...parsed.data, keywords: parsed.data.keywords === null ? [] : parsed.data.keywords, competitors: parsed.data.competitors === null ? [] : parsed.data.competitors };
  const res = await updateProject(gate.ctx, id, body);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ project: res.data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const res = await deleteProject(gate.ctx, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
