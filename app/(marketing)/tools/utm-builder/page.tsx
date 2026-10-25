import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { ToolShell } from "@/components/tools/shell";
import { UtmBuilder } from "@/components/tools/utm-builder";
import { PUBLIC_TOOLS_FLAG } from "@/lib/growth/rules";

export const metadata: Metadata = {
  title: "Free UTM Link Builder",
  description: "Add UTM tags to any link so your analytics show which post, email or ad brought each visitor.",
  alternates: { canonical: "/tools/utm-builder" },
};

export default function UtmBuilderPage() {
  return (
    <ToolShell
      flag={PUBLIC_TOOLS_FLAG}
      eyebrow="Free tool"
      icon={Link2}
      title="UTM link builder"
      description="Tag a link so your analytics can tell you where each visitor came from."
      trail={[{ name: "Tools", path: "/tools" }, { name: "UTM link builder", path: "/tools/utm-builder" }]}
    >
      <UtmBuilder />
    </ToolShell>
  );
}
