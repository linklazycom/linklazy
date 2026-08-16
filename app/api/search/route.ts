import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lightweight autocomplete search across approved sites. We don't have
 * pg_trgm / full-text search set up, so this uses ILIKE on domain and
 * niche with the query tokenized on whitespace (each word must match
 * somewhere) — good enough for a marketplace-sized catalog and avoids
 * a new Postgres extension dependency. Revisit with pg_trgm + a GIN
 * index if the catalog grows into the tens of thousands of listings.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createClient();

  const words = q.split(/\s+/).filter(Boolean).slice(0, 5);

  let query = supabase
    .from("sites")
    .select("id, domain, niche, da, dr, dr_verified, price_amount, link_type")
    .eq("status", "approved")
    .limit(8);

  for (const word of words) {
    query = query.or(`domain.ilike.%${word}%,niche.ilike.%${word}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data ?? [] });
}
