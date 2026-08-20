import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import { getSiteSettings } from "@/lib/site-settings";
import { createClient } from "@/lib/supabase/server";
import { MaintenancePage } from "@/components/layout/maintenance-page";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { headers } from "next/headers";
import { CurrencyProvider } from "@/components/currency/currency-provider";

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

  // Geo-based currency default: Vercel injects the visitor's country on
  // every request via this header (no extra API call, no client-side
  // flash of the wrong currency). Bangladesh -> BDT, everywhere else ->
  // USD. If the header is missing (local dev, non-Vercel host) we fall
  // back to BDT since that's the primary audience. A returning visitor's
  // explicit toggle choice (saved in localStorage inside CurrencyProvider)
  // always overrides this default.
  const headersList = await headers();
  const country = headersList.get("x-vercel-ip-country");
  const initialCurrency: "BDT" | "USD" = country && country !== "BD" ? "USD" : "BDT";

  // Maintenance mode: block every route for everyone except logged-in
  // admins, so the admin can still get in to flip the toggle back off.
  const maintenanceOn = settings.maintenance_mode === "on";
  let isAdmin = false;
  if (maintenanceOn) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
    }
  }

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
        {/* FIX: NavigationProgress uses useSearchParams(), which Next.js
            requires to be wrapped in <Suspense> — without this the build
            throws "useSearchParams() should be wrapped in a suspense
            boundary". */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {maintenanceOn && !isAdmin ? (
          <MaintenancePage />
        ) : (
          <CurrencyProvider initialCurrency={initialCurrency}>{children}</CurrencyProvider>
        )}
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
