import { NextResponse } from "next/server";
import { getBonusSettings } from "@/lib/deposit-bonus-server";

/** Public: is a deposit bonus running, and on what terms. Only numbers, nothing private. */
export async function GET() {
  const s = await getBonusSettings();
  return NextResponse.json(s.enabled ? { enabled: true, minAmount: s.minAmount, percent: s.percent, maxBonus: s.maxBonus } : { enabled: false });
}
