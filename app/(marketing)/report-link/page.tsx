import type { Metadata } from "next";
import { ReportLinkForm } from "@/components/links/report-link-form";

export const metadata: Metadata = {
  title: "Report a short link",
  description: "Report a LinkLazy short link that is a scam, phishing, malware, spam or illegal.",
  robots: { index: false, follow: true },
};

export default async function ReportLinkPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-2 font-display text-3xl font-medium">Report a short link</h1>
      <p className="mb-6 text-sm text-muted">
        Spotted a link that leads to phishing, malware, spam or illegal content? Tell us and we will review it.
      </p>
      <ReportLinkForm initialLink={(slug ?? "").slice(0, 100)} />
    </div>
  );
}
