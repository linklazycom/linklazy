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

// PostgREST's .or() takes a raw filter string where "," separates
// conditions and "()" group them — building that string by interpolating
// user input directly (as this route used to) lets a search term with a
// comma/paren/period in it corrupt the intended filter structure or graft
// on extra OR'd conditions. Escape everything that's syntactically
// meaningful to PostgREST's filter grammar, plus ILIKE's own wildcards so
// a search for a literal "%" or "_" behaves as the user expects.
function escapeOrFilterValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, "")
    .replace(/[()]/g, "")
    .replace(/\./g, "");
}

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
    const safe = escapeOrFilterValue(word);
    if (!safe) continue;
    query = query.or(`domain.ilike.%${safe}%,niche.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data ?? [] });
}
