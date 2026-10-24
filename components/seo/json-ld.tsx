import { safeJsonLd } from "@/lib/seo";

/** A structured-data block that cannot break out of its <script> tag. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />;
}
