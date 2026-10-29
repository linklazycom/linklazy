import { publicLimit } from "@/lib/public-limit";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) { const limited = publicLimit(request, "currency", 120); if (limited) return limited; const supabase = await createClient(); const { data } = await supabase.from("site_settings").select("value").eq("key", "bdt_per_usd").maybeSingle(); const rate = Number(data?.value ?? 125); return NextResponse.json({ bdt_per_usd: Number.isFinite(rate) && rate > 0 ? rate : 125 }); }
