import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <Link href="/" className="mb-8">
        <Logo size={32} />
      </Link>
      <p className="mb-2 font-mono text-sm text-brand-violet">404</p>
      <h1 className="mb-3 font-display text-2xl font-medium">Page not found</h1>
      <p className="mb-6 max-w-sm text-sm text-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <Button variant="secondary">Go home</Button>
        </Link>
        <Link href="/browse">
          <Button>Browse sites</Button>
        </Link>
      </div>
    </main>
  );
}
