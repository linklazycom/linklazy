import { NextResponse } from "next/server";
import { requireProjectUser } from "@/lib/projects/auth";
import { createProject } from "@/lib/projects/service";
import { readJson } from "@/lib/links/http";
import { projectBodySchema } from "@/lib/projects/schema";

export async function POST(request: Request) {
  const gate = await requireProjectUser();
  if ("error" in gate) return gate.error;
  const parsed = projectBodySchema.safeParse(await readJson(request, 100_000));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const res = await createProject(gate.ctx, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error, field: res.field }, { status: res.status });
  return NextResponse.json({ project: res.data }, { status: 201 });
}
