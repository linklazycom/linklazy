import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { createShortLink } from "@/lib/links/service";
import { shortUrlFor } from "@/lib/links/server";
import { readJson } from "@/lib/links/http";

const createSchema = z.object({
  destination_url: z.string().max(2048),
  slug: z.string().max(60).nullish(),
  title: z.string().max(300).nullish(),
  folder: z.string().max(100).nullish(),
  tags: z.union([z.array(z.string().max(60)).max(30), z.string().max(500)]).nullish(),
  expires_at: z.string().max(40).nullish(),
  max_clicks: z.number().int().nullish(),
  password: z.string().max(200).nullish(),
});

export async function POST(request: Request) {
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;

  const body = await readJson(request);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });

  const res = await createShortLink(gate.ctx, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ link: res.data, short_url: shortUrlFor(String(res.data.slug)) }, { status: 201 });
}
