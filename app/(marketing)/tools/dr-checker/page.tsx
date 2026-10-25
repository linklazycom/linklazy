import type { Metadata } from "next";
import { Gauge } from "lucide-react";
import { ToolShell } from "@/components/tools/shell";
import { DrChecker } from "@/components/tools/dr-checker";
import { PUBLIC_TOOLS_FLAG } from "@/lib/growth/rules";

export const metadata: Metadata = {
  title: "Free Domain Rating Checker",
  description: "Check the Ahrefs Domain Rating (DR) of any website for free. No account needed.",
  alternates: { canonical: "/tools/dr-checker" },
};

export default function DrCheckerPage() {
  return (
    <ToolShell
      flag={PUBLIC_TOOLS_FLAG}
      eyebrow="Free tool"
      icon={Gauge}
      title="Domain Rating checker"
      description="Type a website address to see its Ahrefs Domain Rating. No account needed."
      trail={[{ name: "Tools", path: "/tools" }, { name: "Domain Rating checker", path: "/tools/dr-checker" }]}
    >
      <DrChecker />
    </ToolShell>
  );
}
