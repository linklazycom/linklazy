import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserCtx } from "@/lib/links/service";

/**
 * Gate for every logged-in projects API (Batch 12): authenticated and not banned/suspended.
 * Deliberately NOT tied to the Link Management kill-switch: projects are a workspace of their own.
 */
export async function requireProjectUser(): Promise<{ error: NextResponse } | { ctx: UserCtx }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("role, is_banned, is_suspended").eq("id", user.id).single();
  if (profile?.is_banned || profile?.is_suspended) {
    return { error: NextResponse.json({ error: "Your account cannot use this feature." }, { status: 403 }) };
  }
  return { ctx: { userId: user.id, isAdmin: profile?.role === "admin", createdAt: user.created_at ?? null } };
}
