import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_SAVED_SCANS = 10;

const bodySchema = z.object({ save: z.boolean() });

/**
 * Pins/unpins a scan on the buyer's history page. Saved scans are exempt
 * from the automatic "keep latest 10 unsaved" pruning that runs on every
 * new scan (see /api/buyer-scan), so buyers can hold onto a scan they
 * want to come back to even after running many more scans later.
 *
 * Capped at 10 saved scans per buyer — same limit as the auto-pruned
 * history, so a buyer's total "kept" scans (saved + recent) stays
 * predictable rather than growing forever.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Send { save: boolean }" }, { status: 400 });
  }

  // Ownership check — RLS should already scope this, but we filter by
  // buyer_id explicitly on every query below too, belt and braces.
  const { data: scan } = await supabase
    .from("buyer_site_scans")
    .select("id, buyer_id, is_saved")
    .eq("id", id)
    .eq("buyer_id", user.id)
    .single();

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (parsed.data.save && !scan.is_saved) {
    const { count } = await supabase
      .from("buyer_site_scans")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", user.id)
      .eq("is_saved", true);

    if ((count ?? 0) >= MAX_SAVED_SCANS) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_SAVED_SCANS} scans — unsave one first.` },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("buyer_site_scans")
    .update({ is_saved: parsed.data.save })
    .eq("id", id)
    .eq("buyer_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id, is_saved: parsed.data.save });
}
