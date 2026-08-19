import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });

  const { supabase } = check;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, is_suspended, is_flagged, flag_reason, is_banned, banned_reason, seller_tier, buyer_plan, buyer_views_quota, buyer_views_used, buyer_plan_renews_at, seller_plan, wallet_balance"
    )
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email lives on auth.users, not profiles — only the service-role client
  // can list it, so we merge it in here rather than exposing auth.admin to
  // every client-side query in the app.
  const serviceClient = createServiceClient();
  const emails = new Map<string, string>();
  const emailConfirmed = new Map<string, boolean>();
  let page = 1;
  // Paginate through all auth users (Supabase caps listUsers at 1000/page).
  // Fine for a marketplace this size; revisit with a dedicated index if the
  // user base grows into the tens of thousands.
  while (true) {
    const { data, error: listError } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError || !data?.users?.length) break;
    data.users.forEach((u) => {
      if (u.email) emails.set(u.id, u.email);
      emailConfirmed.set(u.id, Boolean(u.email_confirmed_at));
    });
    if (data.users.length < 1000) break;
    page += 1;
  }

  const merged = (profiles ?? []).map((p) => ({
    ...p,
    email: emails.get(p.id) ?? null,
    email_confirmed: emailConfirmed.get(p.id) ?? false,
  }));

  return NextResponse.json({ users: merged });
}

const createUserSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["buyer", "seller", "both", "admin"]).default("buyer"),
});

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId, supabase } = check;

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { email, full_name, role } = parsed.data;

  // Random temp password shown once to the admin — simplest path that
  // doesn't require building a separate invite-acceptance/password-set
  // flow. The admin shares it with the user however they normally would
  // (WhatsApp, email); the user can change it later from their account.
  const tempPassword = Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-6).toUpperCase() + "!9";

  const serviceClient = createServiceClient();
  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError || !created?.user) {
    return NextResponse.json({ error: createError?.message ?? "Could not create user." }, { status: 400 });
  }

  // handle_new_user trigger creates the profiles row automatically from
  // user_metadata.full_name — we just need to set the role if it's not the
  // default.
  if (role !== "buyer") {
    await serviceClient.from("profiles").update({ role }).eq("id", created.user.id);
  }

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "user_created",
    target_table: "profiles",
    target_id: created.user.id,
    metadata: { email, role },
  });

  return NextResponse.json({ ok: true, userId: created.user.id, tempPassword });
}
