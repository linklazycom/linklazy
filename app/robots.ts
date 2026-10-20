import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/api/", "/auth/", "/l/", "/bio/*/go/", "/unsubscribe/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
