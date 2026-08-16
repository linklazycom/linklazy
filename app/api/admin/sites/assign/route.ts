import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { siteSubmissionSchema } from "@/lib/validators/site";
import { fetchDomainRating } from "@/lib/ahrefs";

/**
 * Admin-created listing: same fields as the seller-facing submission form,
 * plus an explicit owner_id chosen by the admin (any account — buyer,
 * seller, or both). Skips the meta-tag ownership challenge and goes
 * straight to "approved", since the admin is vouching for it directly —
 * that's the whole point of listing it from here instead of asking the
 * account holder to submit it themselves.
 */
const adminSiteSchema = siteSubmissionSchema.extend({
  owner_id: z.string().uuid("Pick an account to assign this site to"),
});

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId, supabase } = check;

  const body = await request.json();
  const parsed = adminSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { owner_id, ...siteFields } = parsed.data;

  const serviceClient = createServiceClient();

  // Confirm the account exists before assigning to it.
  const { data: owner } = await serviceClient.from("profiles").select("id, full_name").eq("id", owner_id).single();
  if (!owner) {
    return NextResponse.json({ error: "That account could not be found." }, { status: 400 });
  }

  const { data: site, error } = await serviceClient
    .from("sites")
    .insert({ ...siteFields, owner_id, status: "approved" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark ownership verified immediately — admin-listed sites skip the
  // self-serve meta-tag challenge.
  await serviceClient.from("site_verifications").insert({
    site_id: site.id,
    method: "admin_assigned",
    status: "verified",
    verified_at: new Date().toISOString(),
  });

  // Best-effort DR check, same as the normal submission flow.
  try {
    const result = await fetchDomainRating(siteFields.url);
    if (result.ok && result.domainRating != null) {
      await serviceClient
        .from("sites")
        .update({ dr_verified: result.domainRating, dr_verified_at: new Date().toISOString(), dr_check_status: "ok" })
        .eq("id", site.id);
    }
  } catch {
    // Weekly cron is the safety net.
  }

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "site_created_and_assigned",
    target_table: "sites",
    target_id: site.id,
    metadata: { domain: siteFields.url, owner_id, owner_name: owner.full_name },
  });

  return NextResponse.json({ id: site.id });
}

const reassignSchema = z.object({
  site_id: z.string().uuid(),
  owner_id: z.string().uuid(),
});

/**
 * Reassign an EXISTING site to a different account — for cases like a
 * seller transferring a property, an account being consolidated, or a
 * site originally listed under the wrong account.
 */
export async function PATCH(request: Request) {
  const check = await requireAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error.message }, { status: check.error.status });
  const { adminId, supabase } = check;

  const body = await request.json();
  const parsed = reassignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { site_id, owner_id } = parsed.data;

  const serviceClient = createServiceClient();

  const { data: owner } = await serviceClient.from("profiles").select("id, full_name").eq("id", owner_id).single();
  if (!owner) {
    return NextResponse.json({ error: "That account could not be found." }, { status: 400 });
  }

  const { data: prevSite } = await serviceClient.from("sites").select("owner_id, domain").eq("id", site_id).single();

  const { error } = await serviceClient.from("sites").update({ owner_id }).eq("id", site_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action: "site_reassigned",
    target_table: "sites",
    target_id: site_id,
    metadata: { domain: prevSite?.domain, from_owner_id: prevSite?.owner_id, to_owner_id: owner_id, to_owner_name: owner.full_name },
  });

  return NextResponse.json({ ok: true });
}
