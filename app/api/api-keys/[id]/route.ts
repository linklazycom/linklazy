import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { createServiceClient } from "@/lib/supabase/service";

const UUID = z.string().uuid();

/** Revokes a key immediately (the row is kept so "last used" history stays visible). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;

  const { data, error } = await createServiceClient()
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", gate.ctx.userId)
    .is("revoked_at", null)
    .select("id");
  if (error) return NextResponse.json({ error: "Could not revoke the key." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
