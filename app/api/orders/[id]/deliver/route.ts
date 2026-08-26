import { NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureArchiveSnapshot } from "@/lib/archive-snapshot";
import { z } from "zod";

const deliverSchema = z.object({
  proof_url: z.string().url(),
  proof_screenshot_url: z.string().url().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order || order.seller_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Delivery is only allowed once the seller has accepted the order.
  // "awaiting_seller_site" stays allowed for any order that was already
  // in-flight before the accept/reject gate existed.
  if (!["awaiting_seller_site", "in_progress"].includes(order.status)) {
    return NextResponse.json(
      { error: "This order isn't ready for delivery yet." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = deliverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // PERF: the Wayback Machine "save" endpoint routinely takes 5-20s.
  // Marking delivery must not block on it — the archive snapshot is
  // best-effort proof, not something the response should wait for.
  // We mark delivered immediately, and capture+store the snapshot
  // afterwards via next/server's after(), which keeps running after
  // the response has already gone back to the client.
  const { error } = await supabase
    .from("orders")
    .update({
      status: "delivered",
      proof_url: parsed.data.proof_url,
      proof_screenshot_url: parsed.data.proof_screenshot_url,
      delivered_at: new Date().toISOString(),
      last_link_check_at: new Date().toISOString(),
      last_link_check_ok: true,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/admin/orders");

  after(async () => {
    const archiveUrl = await captureArchiveSnapshot(parsed.data.proof_url);
    if (archiveUrl) {
      const service = createServiceClient();
      await service.from("orders").update({ archive_url: archiveUrl }).eq("id", id);
    }
  });

  return NextResponse.json({ ok: true });
}
