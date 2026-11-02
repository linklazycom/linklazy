import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { getFlags } from "@/lib/feature-flags";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code || code.length > 64) return NextResponse.json({ referrerId: null });

  const { allowed } = await checkRateLimit("referral_resolve", getRequestIp(request), { max: 60, windowMinutes: 10 });
  if (!allowed) return NextResponse.json({ referrerId: null }, { status: 429 });

  // Referrals switched off in Admin > Tools & features: nobody gets attached as a referrer at sign-up.
  const flags = await getFlags(["feature_tool_referrals"]);
  if (flags["feature_tool_referrals"] === false) return NextResponse.json({ referrerId: null });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  return NextResponse.json({ referrerId: data?.id ?? null });
}
