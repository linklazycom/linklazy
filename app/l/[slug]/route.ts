import { handleRedirect, readPasswordField } from "@/lib/links/redirect";

// Never cached: every visit must be counted and every limit/expiry/takedown enforced.
export const dynamic = "force-dynamic";

// The redirect pipeline itself lives in lib/links/redirect.ts (shared with custom domains).
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleRedirect(request, (await params).slug, null);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleRedirect(request, (await params).slug, null);
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const password = await readPasswordField(request);
  return handleRedirect(request, (await params).slug, password);
}
