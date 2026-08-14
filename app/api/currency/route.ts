import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET() { const supabase = await createClient(); const { data } = await supabase.from("admin_settings").select("value").eq("key", "bdt_per_usd").maybeSingle(); const rate = Number(data?.value ?? 125); return NextResponse.json({ bdt_per_usd: Number.isFinite(rate) && rate > 0 ? rate : 125 }); }
