import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLinkFeatureOn } from "@/lib/links/server";

export interface LinkUserCtx {
  userId: string;
  isAdmin: boolean;
  createdAt: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Gate for every logged-in link API: authenticated, not banned/suspended, and the
 * Link Management kill-switch is on. Returns a ready-made error response otherwise.
 */
export async function requireLinkUser(): Promise<{ error: NextResponse } | { ctx: LinkUserCtx }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_banned, is_suspended")
    .eq("id", user.id)
    .single();
  if (profile?.is_banned || profile?.is_suspended) {
    return { error: NextResponse.json({ error: "Your account cannot use this feature." }, { status: 403 }) };
  }
  if (!(await isLinkFeatureOn())) {
    return { error: NextResponse.json({ error: "Link management is currently turned off." }, { status: 403 }) };
  }
  return {
    ctx: { userId: user.id, isAdmin: profile?.role === "admin", createdAt: user.created_at ?? null, supabase },
  };
}
