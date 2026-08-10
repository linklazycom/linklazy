import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import { getSiteSettings } from "@/lib/site-settings";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "LinkLazy — Verified sites, effortless backlink exchange",
    template: "%s | LinkLazy",
  },
  description:
    "LinkLazy is a vetted marketplace for exchanging and buying backlinks between verified sites, with transparent metrics and escrow-protected orders.",
  openGraph: {
    images: ["/logo.png"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  const gaId = settings.ga_measurement_id as string;

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        {(settings.gsc_verification_code as string) && (
          <meta name="google-site-verification" content={settings.gsc_verification_code as string} />
        )}
        {(settings.bing_verification_code as string) && (
          <meta name="msvalidate.01" content={settings.bing_verification_code as string} />
        )}
        {(settings.pinterest_verification_code as string) && (
          <meta name="p:domain_verify" content={settings.pinterest_verification_code as string} />
        )}
        {(settings.yandex_verification_code as string) && (
          <meta name="yandex-verification" content={settings.yandex_verification_code as string} />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "LinkLazy",
              url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com",
              logo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com"}/logo.png`,
              description:
                "A vetted marketplace for exchanging and buying backlinks between verified sites.",
            }),
          }}
        />
      </head>
      <body>
        {children}
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}

