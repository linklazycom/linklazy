import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runVerification } from "@/lib/verification";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: site } = await supabase
    .from("sites")
    .select("id, url, owner_id")
    .eq("id", id)
    .single();

  if (!site || site.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: verification } = await supabase
    .from("site_verifications")
    .select("*")
    .eq("site_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!verification) {
    return NextResponse.json({ error: "No verification challenge found" }, { status: 404 });
  }

  const result = await runVerification(verification.method, site.url, verification.token);

  await supabase
    .from("site_verifications")
    .update({
      status: result.ok ? "verified" : "failed",
      last_checked_at: new Date().toISOString(),
      verified_at: result.ok ? new Date().toISOString() : null,
    })
    .eq("id", verification.id);

  return NextResponse.json(result);
}
