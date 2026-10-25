import type { Metadata } from "next";
import { QrCode } from "lucide-react";
import { ToolShell } from "@/components/tools/shell";
import { QrGenerator } from "@/components/tools/qr-generator";
import { PUBLIC_TOOLS_FLAG } from "@/lib/growth/rules";

export const metadata: Metadata = {
  title: "Free QR Code Generator",
  description: "Make a QR code for any link or text and download it as PNG or SVG. Made in your browser; nothing is uploaded.",
  alternates: { canonical: "/tools/qr-code" },
};

export default function QrCodePage() {
  return (
    <ToolShell
      flag={PUBLIC_TOOLS_FLAG}
      eyebrow="Free tool"
      icon={QrCode}
      title="QR code generator"
      description="Turn a link or text into a QR code you can download. It is made in your browser."
      trail={[{ name: "Tools", path: "/tools" }, { name: "QR code generator", path: "/tools/qr-code" }]}
    >
      <QrGenerator />
    </ToolShell>
  );
}
