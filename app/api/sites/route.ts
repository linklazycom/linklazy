import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteSubmissionSchema } from "@/lib/validators/site";
import { generateVerificationToken } from "@/lib/verification";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

  return NextResponse.json({ id: site.id });
}
