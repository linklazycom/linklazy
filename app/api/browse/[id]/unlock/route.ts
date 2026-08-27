import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: siteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email before unlocking listings." },
      { status: 403 }
    );
  }

  // method: "quota" (existing subscription-plan unlock) | "wallet" (new pay-per-view)
  // Defaults to "quota" so any existing client that POSTs with no body keeps working.
  let method: "quota" | "wallet" = "quota";
  try {
    const body = await request.json();
    if (body?.method === "wallet") method = "wallet";
  } catch {
    // no body sent — fall back to default
  }

  if (method === "wallet") {
    return handleWalletUnlock(supabase, user.id, siteId);
  }
  return handleQuotaUnlock(supabase, user.id, siteId);
}

async function handleQuotaUnlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  siteId: string
) {
  // Already unlocked? No charge.
  const { data: existing } = await supabase
    .from("credits_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "unlock_spend")
    .eq("related_site_id", siteId)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, alreadyUnlocked: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("buyer_plan, buyer_views_quota, buyer_views_used")
    .eq("id", userId)
    .single();

  if (!profile || profile.buyer_plan === "free" || !profile.buyer_views_quota) {
    return NextResponse.json(
      { error: "No plan views available on this account. Try paying per view instead." },
      { status: 402 }
    );
  }

  if (profile.buyer_views_used >= profile.buyer_views_quota) {
    return NextResponse.json(
      { error: "You've used all your views for this billing period." },
      { status: 402 }
    );
  }

  const newUsed = profile.buyer_views_used + 1;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ buyer_views_used: newUsed })
    .eq("id", userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await supabase.from("credits_ledger").insert({
    user_id: userId,
    amount: -1,
    type: "unlock_spend",
    related_site_id: siteId,
    balance_after: profile.buyer_views_quota - newUsed,
    notes: "Site detail unlock",
  });

  return NextResponse.json({ ok: true, alreadyUnlocked: false });
}

async function handleWalletUnlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  siteId: string
) {
  // The RPC does the whole charge/pay/unlock atomically (see
  // sql/pay_per_view_wallet.sql -> unlock_site_with_wallet). This avoids
  // race conditions between concurrent unlock requests on the same site.
  const { data, error } = await supabase
    .rpc("unlock_site_with_wallet", {
      p_buyer_id: userId,
      p_site_id: siteId,
    })
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { ok: boolean; error: string | null; expires_at: string | null };

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not unlock this site." }, { status: 402 });
  }

  return NextResponse.json({ ok: true, expiresAt: result.expires_at });
}
