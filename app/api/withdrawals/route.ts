import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  amount: z.number().int().positive(),
  bkash_number: z.string().trim().min(11).max(14),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data: credits } = await supabase
    .from("referral_credits")
    .select("amount")
    .eq("referrer_id", user.id);
  const totalEarned = (credits ?? []).reduce((sum, c) => sum + c.amount, 0);

  // Pending/approved/paid requests all lock funds — only a rejected
  // request frees the balance back up.
  const { data: existingRequests } = await supabase
    .from("withdrawal_requests")
    .select("amount, status")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved", "paid"]);
  const totalLocked = (existingRequests ?? []).reduce((sum, r) => sum + r.amount, 0);

  const available = totalEarned - totalLocked;

  if (parsed.data.amount > available) {
    return NextResponse.json(
      { error: `You can withdraw at most ৳${available}.` },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("withdrawal_requests").insert({
    user_id: user.id,
    amount: parsed.data.amount,
    bkash_number: parsed.data.bkash_number,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
