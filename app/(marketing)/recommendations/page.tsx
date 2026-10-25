import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { ToolShell } from "@/components/tools/shell";
import { RecommendationsForm } from "@/components/tools/recommendations-form";
import { PUBLIC_RECOMMEND_FLAG } from "@/lib/growth/rules";

export const metadata: Metadata = {
  title: "Find sites for your website",
  description: "Enter your website address and see listed sites in the same niche, with Domain Rating and price. No account needed.",
  alternates: { canonical: "/recommendations" },
};

export default function RecommendationsPage() {
  return (
    <ToolShell
      flag={PUBLIC_RECOMMEND_FLAG}
      eyebrow="Recommendations"
      icon={Sparkles}
      title="Find sites for your website"
      description="Enter your website address and we'll show listed sites in the same niche."
      trail={[{ name: "Recommendations", path: "/recommendations" }]}
    >
      <RecommendationsForm />
    </ToolShell>
  );
}
