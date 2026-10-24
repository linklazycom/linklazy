import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { OgCard, OG_SIZE } from "@/components/seo/og-card";
import { clampText } from "@/lib/seo";

export const alt = "LinkLazy blog article";
export const size = OG_SIZE;
export const contentType = "image/png";

/** A share picture with the article's own title. Falls back to a generic title if the article cannot be read. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let title = "LinkLazy blog";
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("articles").select("title").eq("slug", slug).eq("status", "published").single();
    if (data?.title) title = clampText(String(data.title), 110);
  } catch {
    // keep the generic title
  }
  return new ImageResponse(<OgCard eyebrow="Blog" title={title} />, { ...OG_SIZE });
}
