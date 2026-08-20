import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { scanBuyerSite } from "@/lib/site-scanner";

const schema = z.object({
  url: z.string().trim().refine((v) => /^https?:\/\//.test(v), "Include http:// or https://"),
});

/**
 * POST /api/sites/suggest-niche
 *
 * Same keyword-matching scanner used by the buyer-side scan feature,
 * reused here to auto-suggest a niche when a seller lists a site — they
 * still pick the final value from the dropdown themselves, this just
 * saves them a guess. Doesn't write a buyer_site_scans row (this isn't
 * a buyer scan) and doesn't count against the buyer scan rate limit.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const result = await scanBuyerSite(parsed.data.url);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: `Couldn't scan that URL: ${(err as Error).message}` }, { status: 502 });
  }
}
