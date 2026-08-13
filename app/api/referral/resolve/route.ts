import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ referrerId: null });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  return NextResponse.json({ referrerId: data?.id ?? null });
}
