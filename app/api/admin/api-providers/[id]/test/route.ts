import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { testProvider } from "@/lib/api-providers";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  const { id } = await params;
  return NextResponse.json(await testProvider(id));
}
