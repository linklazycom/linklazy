import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteDetailClient } from "./site-detail-client";

interface PublicSiteFields {
  id: string;
  niche: string;
  da: number | null;
  dr: number | null;
  dr_verified: number | null;
  organic_traffic: number | null;
  price_amount: number | null;
  link_type: string;
  accepts_exchange: boolean;
  accepts_paid: boolean;
}

// Fields safe to expose pre-unlock — mirrors the same allowlist the client
// page uses for a locked listing. Never select `domain`/`url` here: they're
// intentionally hidden until a buyer unlocks the listing, and metadata is
// public (visible in page source, search results, link previews) even to
// someone who never opens the page.
async function getPublicSiteFields(id: string): Promise<PublicSiteFields | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sites")
    .select("id, niche, da, dr, dr_verified, price_amount, link_type, accepts_exchange, accepts_paid, organic_traffic")
    .eq("id", id)
    .eq("status", "approved")
    .single();
  return data as PublicSiteFields | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const site = await getPublicSiteFields(id);

  if (!site) {
    return { title: "Listing not found — LinkLazy" };
  }

  const dr = site.dr_verified ?? site.dr ?? null;
  const orderType =
    site.accepts_paid && site.accepts_exchange
      ? "paid placement or exchange"
      : site.accepts_paid
        ? "paid placement"
        : "link exchange";

  const title = `${site.niche} ${site.link_type} backlink site${dr != null ? ` — DR ${dr}` : ""} | LinkLazy`;
  const description = [
    `${site.niche} site available for ${orderType} on LinkLazy.`,
    dr != null ? `Domain Rating ${dr}.` : null,
    site.da != null ? `DA ${site.da}.` : null,
    site.organic_traffic != null ? `~${site.organic_traffic.toLocaleString()} monthly organic visits.` : null,
    site.price_amount != null ? `Starting from ৳${site.price_amount.toLocaleString()}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com";
  const canonical = `${siteUrl}/browse/${site.id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicSiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = await getPublicSiteFields(id);
  if (!site) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com";
  const dr = site.dr_verified ?? site.dr ?? null;

  // Product/Offer structured data for rich search results. Deliberately
  // omits the actual domain/URL (still hidden pre-unlock) and uses the
  // marketplace listing URL as the item's own identity.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${site.niche} backlink placement`,
    category: site.niche,
    url: `${siteUrl}/browse/${site.id}`,
    ...(site.price_amount != null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "BDT",
            price: site.price_amount,
            availability: "https://schema.org/InStock",
            url: `${siteUrl}/browse/${site.id}`,
          },
        }
      : {}),
    ...(dr != null
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "Domain Rating",
            value: dr,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteDetailClient id={id} />
    </>
  );
}
