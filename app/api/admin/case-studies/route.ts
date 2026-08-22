import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";

const caseStudySchema = z.object({
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1),
  metric_before: z.string().trim().max(100).optional(),
  metric_after: z.string().trim().max(100).optional(),
  published: z.boolean().optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { supabase } = admin;

  const body = await request.json();
  const parsed = caseStudySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { error } = await supabase.from("case_studies").insert(parsed.data);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
