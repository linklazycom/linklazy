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

  // Pay-per-view from the wallet is the only way to unlock a site now. The old
  // subscription "quota" method was retired together with the plans, so it no
  // longer reads or writes profiles.buyer_* or credits_ledger. Clients that
  // still send method "quota" get a clear message instead of a silent charge.
  let method: "quota" | "wallet" = "wallet";
  try {
    const body = await request.json();
    if (body?.method === "quota") method = "quota";
  } catch {
    // no body sent - wallet is the default
  }

  if (method === "quota") {
    return NextResponse.json(
      { error: "Plan views are no longer available. Please unlock with your wallet (pay per view)." },
      { status: 410 }
    );
  }
  return handleWalletUnlock(supabase, user.id, siteId);
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
