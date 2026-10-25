import type { Metadata } from "next";
import { Coins } from "lucide-react";
import { ToolShell } from "@/components/tools/shell";
import { PriceCheck } from "@/components/tools/price-check";
import { PUBLIC_TOOLS_FLAG } from "@/lib/growth/rules";

export const metadata: Metadata = {
  title: "Backlink Price Check",
  description: "See what sellers on LinkLazy ask for backlinks from sites with a similar Domain Rating, using live listings.",
  alternates: { canonical: "/tools/price-check" },
};

export default function PriceCheckPage() {
  return (
    <ToolShell
      flag={PUBLIC_TOOLS_FLAG}
      eyebrow="Free tool"
      icon={Coins}
      title="Backlink price check"
      description="Enter a Domain Rating and see the prices sellers on LinkLazy currently ask for similar sites."
      trail={[{ name: "Tools", path: "/tools" }, { name: "Backlink price check", path: "/tools/price-check" }]}
    >
      <PriceCheck />
    </ToolShell>
  );
}
