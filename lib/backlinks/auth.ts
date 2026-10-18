import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserCtx } from "@/lib/links/service";
import { isBacklinkMonitorOn } from "@/lib/backlinks/feature";

/** Gate for every logged-in backlink API (Batch 13): signed in, not banned/suspended, feature switch on. */
export async function requireBacklinkUser(): Promise<{ error: NextResponse } | { ctx: UserCtx }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("role, is_banned, is_suspended").eq("id", user.id).single();
  if (profile?.is_banned || profile?.is_suspended) {
    return { error: NextResponse.json({ error: "Your account cannot use this feature." }, { status: 403 }) };
  }
  if (!(await isBacklinkMonitorOn())) {
    return { error: NextResponse.json({ error: "Backlink monitoring is currently turned off." }, { status: 403 }) };
  }
  return { ctx: { userId: user.id, isAdmin: profile?.role === "admin", createdAt: user.created_at ?? null } };
}
