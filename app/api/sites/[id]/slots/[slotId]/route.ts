import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function assertOwnsSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slotId: string,
  userId: string
) {
  const { data: slot } = await supabase
    .from("site_link_slots")
    .select("id, site_id, sites!inner(owner_id)")
    .eq("id", slotId)
    .single();

  // @ts-expect-error -- joined relation shape isn't in the placeholder Database type
  if (!slot || slot.sites.owner_id !== userId) return null;
  return slot;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const { slotId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const slot = await assertOwnsSlot(supabase, slotId, user.id);
  if (!slot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { error } = await supabase
    .from("site_link_slots")
    .update({ is_active: Boolean(body.is_active) })
    .eq("id", slotId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const { slotId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const slot = await assertOwnsSlot(supabase, slotId, user.id);
  if (!slot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase.from("site_link_slots").delete().eq("id", slotId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
