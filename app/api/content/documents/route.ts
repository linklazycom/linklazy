import { NextResponse } from "next/server";
import { requireProjectUser } from "@/lib/projects/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateNewDocument } from "@/lib/content/documents";
import { DOC_MAX_PER_USER } from "@/lib/content/kinds";

/** Saves a draft the user has edited. Writes use the service client after the user is identified; users only READ their rows (RLS). */
export async function POST(request: Request) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const body = await readJson(request, 120_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const v = validateNewDocument(body as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ error: v.message, field: v.field }, { status: 400 });

  const supabase = await createClient();
  const { count } = await supabase.from("content_documents").select("id", { count: "exact", head: true }).eq("user_id", gate.ctx.userId);
  if (!gate.ctx.isAdmin && (count ?? 0) >= DOC_MAX_PER_USER) {
    return NextResponse.json({ error: `You can keep up to ${DOC_MAX_PER_USER} saved documents. Delete some to save more.` }, { status: 409 });
  }

  const service = createServiceClient();
  if (v.value.projectId) {
    const { data: p } = await service.from("projects").select("id").eq("id", v.value.projectId).eq("user_id", gate.ctx.userId).maybeSingle();
    if (!p) return NextResponse.json({ error: "Project not found.", field: "project_id" }, { status: 404 });
  }

  const { data, error } = await service
    .from("content_documents")
    .insert({ user_id: gate.ctx.userId, kind: v.value.kind, title: v.value.title, body: v.value.body, project_id: v.value.projectId })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not save the document." }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
