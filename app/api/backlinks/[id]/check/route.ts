import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBacklinkUser } from "@/lib/backlinks/auth";
import { checkNow } from "@/lib/backlinks/service";

// One page fetch (up to ~12 s) plus a few database calls.
export const maxDuration = 30;

const UUID = z.string().uuid();

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Backlink not found." }, { status: 404 });
  const gate = await requireBacklinkUser();
  if ("error" in gate) return gate.error;
  const res = await checkNow(gate.ctx, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res.data);
}
