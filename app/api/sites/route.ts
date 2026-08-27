import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteSubmissionSchema } from "@/lib/validators/site";
import { generateVerificationToken } from "@/lib/verification";
import { fetchDomainRating } from "@/lib/ahrefs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const canSell = profile?.role === "seller" || profile?.role === "both" || profile?.role === "admin";
  if (!canSell) {
    return NextResponse.json(
      { error: "Switch your account to Sell links or Both (Profile settings) to list a site." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = siteSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: site, error } = await supabase
    .from("sites")
    .insert({ ...parsed.data, owner_id: user.id })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Immediately create a pending meta-tag verification challenge for this site.
  const token = generateVerificationToken();
  await supabase.from("site_verifications").insert({
    site_id: site.id,
    method: "meta_tag",
    token,
  });

  // Best-effort DR check on submission, so sellers see the verified number
  // right away instead of waiting for the weekly cron. We `await` this
  // (rather than fire-and-forget) because on Vercel's serverless runtime a
  // background promise can get killed once the response is sent — the
  // 10s timeout inside fetchDomainRating keeps this from stalling the
  // submit request too long. If it errors, dr_check_status just stays
  // "pending" and the weekly cron picks it up later.
  try {
    const result = await fetchDomainRating(parsed.data.url);
    if (result.ok && result.domainRating != null) {
      await supabase
        .from("sites")
        .update({
          dr_verified: result.domainRating,
          dr_verified_at: new Date().toISOString(),
          dr_check_status: "ok",
        })
        .eq("id", site.id);
    }
  } catch {
    // Swallow — weekly cron is the safety net.
  }

  return NextResponse.json({ id: site.id });
}
