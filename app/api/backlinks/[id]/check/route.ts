import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBacklinkUser } from "@/lib/backlinks/auth";
import { checkNow } from "@/lib/backlinks/service";

// One page fetch (up to ~12 s) plus a few database calls.
export const maxDuration = 30;

const UUID = z.string().uuid();
const bodySchema = z.object({ confirm_price: z.number().int().min(0).max(100_000).nullish(), request_id: z.string().max(100).nullish() }).partial();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return NextResponse.json({ error: "Backlink not found." }, { status: 404 });
  const gate = await requireBacklinkUser();
  if ("error" in gate) return gate.error;
  // The body is optional (only used to confirm a paid extra check).
  let body: z.infer<typeof bodySchema> = {};
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (parsed.success) body = parsed.data;
  } catch {
    /* no body */
  }
  const res = await checkNow(gate.ctx, id, { confirmPrice: body.confirm_price, requestId: body.request_id });
  if (!res.ok) return NextResponse.json({ error: res.error, price: res.price, needs_payment: res.needsPayment }, { status: res.status });
  return NextResponse.json(res.data);
}
