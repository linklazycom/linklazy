/**
 * The facts about the business behind LinkLazy, in ONE place (Batch 17B). The About page, the footer, the legal pages and the
 * structured data all read from here, so a correction is made once. Only facts the owner supplied are written here:
 * add nothing that cannot be proven (no team names, awards, user counts or registrations that are not real).
 */
export const BUSINESS = {
  brandName: "LinkLazy",
  legalName: "LinkLazy LLC",
  email: "hi@linklazy.com",
  /** The year the company was established (the owner's statement). */
  companyEstablished: 2014,
  /** The year this marketplace website started operating (the owner's statement). */
  websiteStarted: 2026,
  address: {
    streetAddress: "1 apt",
    locality: "Bronx",
    region: "NY",
    postalCode: "10463",
    countryCode: "US",
    countryName: "USA",
  },
} as const;

/** The postal address as one line, e.g. for a footer or an email signature. */
export function formatAddress(a: typeof BUSINESS.address = BUSINESS.address): string {
  return `${a.streetAddress}, ${a.locality}, ${a.region} ${a.postalCode}, ${a.countryName}`;
}

/** schema.org Organization for the site, built only from the facts above. */
export function organizationSchema(siteUrl: string) {
  const a = BUSINESS.address;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BUSINESS.brandName,
    legalName: BUSINESS.legalName,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    email: BUSINESS.email,
    foundingDate: String(BUSINESS.companyEstablished),
    description: "A vetted marketplace for exchanging and buying backlinks between verified sites.",
    address: {
      "@type": "PostalAddress",
      streetAddress: a.streetAddress,
      addressLocality: a.locality,
      addressRegion: a.region,
      postalCode: a.postalCode,
      addressCountry: a.countryCode,
    },
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: BUSINESS.email },
  };
}

/** "© 2026 LinkLazy LLC" for the footer. */
export function copyrightLine(year: number): string {
  return `© ${year} ${BUSINESS.legalName}. All rights reserved.`;
}
