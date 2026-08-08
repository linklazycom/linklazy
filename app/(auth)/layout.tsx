import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo size={32} />
        </Link>
        <div className="rounded-chip border border-line bg-white p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
