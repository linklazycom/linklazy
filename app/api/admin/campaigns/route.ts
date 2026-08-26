import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";

/**
 * Splits the user base by role (buyer/seller/all) so admins can target
 * offers narrowly — e.g. a nudge to sellers only, or an announcement to
 * everyone.
 *
 * (This used to also segment by plan — free vs. paid — but subscription
 * plans were removed product-wide, so every account is permanently
 * "free" now and that filter either matched everyone or nobody depending
 * on which way you set it. Dropped from Admin -> Campaigns accordingly.)
 */
async function resolveRecipients(segmentRole: "all" | "buyer" | "seller") {
  const serviceClient = createServiceClient();

  let query = serviceClient.from("profiles").select("id, full_name, role");

  if (segmentRole === "buyer") query = query.in("role", ["buyer", "both"]);
  else if (segmentRole === "seller") query = query.in("role", ["seller", "both"]);
  else query = query.neq("role", "admin");

  const { data: profiles, error } = await query;
  if (error || !profiles) return { error: error?.message ?? "Could not load users", recipients: [] as { id: string; email: string }[] };

  // Emails live on auth.users, not profiles.
  const emails = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error: listError } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError || !data?.users?.length) break;
    data.users.forEach((u) => {
      if (u.email) emails.set(u.id, u.email);
    });
    if (data.users.length < 1000) break;
    page += 1;
  }

  const recipients = profiles
    .map((p) => ({ id: p.id, email: emails.get(p.id) ?? "" }))
    .filter((r) => r.email);

  return { error: null, recipients };
}

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });

  const { data: campaigns, error } = await check.supabase
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns });
}

const sendSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  html_body: z.string().trim().min(1),
  segment_role: z.enum(["all", "buyer", "seller"]).default("all"),
  // If true, only counts recipients and returns without sending — used by
  // the admin UI to show "This will reach 214 users" before the real send.
  preview_only: z.boolean().optional(),
});

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId, supabase } = check;

  const body = await request.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { subject, html_body, segment_role, preview_only } = parsed.data;

  const { error: recipientsError, recipients } = await resolveRecipients(segment_role);
  if (recipientsError) return NextResponse.json({ error: recipientsError }, { status: 500 });

  if (preview_only) {
    return NextResponse.json({ recipientCount: recipients.length });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No users match this segment." }, { status: 400 });
  }

  const { data: campaign, error: insertError } = await supabase
    .from("email_campaigns")
    .insert({
      subject,
      html_body,
      segment_role,
      status: "sending",
      total_recipients: recipients.length,
      created_by: adminId,
    })
    .select()
    .single();

  if (insertError || !campaign) {
    return NextResponse.json({ error: insertError?.message ?? "Could not create campaign" }, { status: 500 });
  }

  // Fire-and-track: send sequentially with a small delay so we stay well
  // within Resend's rate limit, same pattern as the dr-refresh cron. For a
  // marketplace this size (hundreds, not millions, of users) this finishes
  // comfortably inside a single serverless invocation.
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const result = await sendEmail({ to: recipient.email, subject, html: html_body });
    if (result.ok) sent++;
    else failed++;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  await supabase
    .from("email_campaigns")
    .update({
      status: failed === recipients.length ? "failed" : "sent",
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "email_campaign_sent",
    target_table: "email_campaigns",
    target_id: campaign.id,
    metadata: { subject, segment_role, sent, failed, total: recipients.length },
  });

  return NextResponse.json({ ok: true, sent, failed, total: recipients.length });
}
