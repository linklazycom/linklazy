import { createClient } from "@/lib/supabase/server";

/**
 * Returns the calling admin's user id if they're authenticated and have
 * role='admin', otherwise returns a ready-to-send NextResponse error. Every
 * admin/users/* route starts with this so the "who can do this" check lives
 * in one place instead of being copy-pasted (and drifting) across routes.
 */
export async function requireAdmin(): Promise<
  | { error: { message: string; status: 401 | 403 } }
  | { adminId: string; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: { message: "Not authenticated", status: 401 as const } };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { error: { message: "Forbidden", status: 403 as const } };
  }

  return { adminId: user.id, supabase };
}
