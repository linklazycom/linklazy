import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLinkUser } from "@/lib/links/auth";
import { encodeQr, qrToSvg, qrColorsOk } from "@/lib/links/qr";
import { qrToPng } from "@/lib/links/qr-png";
import { shortUrlFor } from "@/lib/links/server";

function color(v: string | null, fallback: string): string {
  if (!v) return fallback;
  const c = v.startsWith("#") ? v : `#${v}`;
  return c.toLowerCase();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  const gate = await requireLinkUser();
  if ("error" in gate) return gate.error;

  // Row Level Security: owners (and admins) can read this row, nobody else.
  const { data: link } = await gate.ctx.supabase.from("short_links").select("slug, user_id").eq("id", id).maybeSingle();
  if (!link || (link.user_id !== gate.ctx.userId && !gate.ctx.isAdmin)) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const q = new URL(request.url).searchParams;
  const format = q.get("format") === "svg" ? "svg" : "png";
  const size = Math.min(2048, Math.max(128, Number(q.get("size")) || 512));
  const fg = color(q.get("fg"), "#000000");
  const bg = color(q.get("bg"), "#ffffff");
  if (!qrColorsOk(fg, bg)) {
    return NextResponse.json({ error: "Use a dark code colour on a light background with strong contrast." }, { status: 400 });
  }

  const matrix = encodeQr(shortUrlFor(link.slug, "qr"), "M");
  const download = q.get("download") === "1";
  const headers: Record<string, string> = { "Cache-Control": "private, max-age=3600" };
  if (download) headers["Content-Disposition"] = `attachment; filename="qr-${link.slug}.${format}"`;

  if (format === "svg") {
    return new NextResponse(qrToSvg(matrix, { fg, bg }), { headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" } });
  }
  const png = qrToPng(matrix, { targetPx: size, fg, bg });
  return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}
