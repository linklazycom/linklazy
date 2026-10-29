import { publicLimit } from "@/lib/public-limit";
import { NextResponse } from "next/server";
import { getBonusSettings } from "@/lib/deposit-bonus-server";

/** Public: is a deposit bonus running, and on what terms. Only numbers, nothing private. */
export async function GET(request: Request) {
  const limited = publicLimit(request, "bonus_offer", 60);
  if (limited) return limited;
  const s = await getBonusSettings();
  return NextResponse.json(s.enabled ? { enabled: true, minAmount: s.minAmount, percent: s.percent, maxBonus: s.maxBonus } : { enabled: false });
}
