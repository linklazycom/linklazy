import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center font-display text-lg font-semibold">
          LinkLazy
        </Link>
        <div className="rounded-chip border border-line bg-white p-8">{children}</div>
      </div>
    </div>
  );
}
