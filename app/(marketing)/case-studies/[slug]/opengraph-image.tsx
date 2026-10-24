import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { OgCard, OG_SIZE } from "@/components/seo/og-card";
import { clampText } from "@/lib/seo";

export const alt = "LinkLazy case study";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let title = "LinkLazy case study";
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("case_studies").select("title").eq("slug", slug).eq("published", true).single();
    if (data?.title) title = clampText(String(data.title), 110);
  } catch {
    // keep the generic title
  }
  return new ImageResponse(<OgCard eyebrow="Case study" title={title} />, { ...OG_SIZE });
}
