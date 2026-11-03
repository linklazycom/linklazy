import { NextResponse } from "next/server";
import { requireProjectUser } from "@/lib/projects/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { validateOppBulk } from "@/lib/opportunities/rules";

/** Sets the same status on several of the user's own opportunities at once (Batch 23C). Others' ids are silently left alone. */
export async function POST(request: Request) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const body = await readJson(request, 20_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const v = validateOppBulk(body as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });

  const { data, error } = await createServiceClient()
    .from("opportunities")
    .update({ status: v.status, updated_at: new Date().toISOString() })
    .in("id", v.ids)
    .eq("user_id", gate.ctx.userId)
    .select("id");
  if (error) return NextResponse.json({ error: "Could not save the change." }, { status: 500 });
  return NextResponse.json({ ok: true, updated: (data ?? []).length });
}
