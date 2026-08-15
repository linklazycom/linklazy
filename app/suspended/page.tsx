import Link from "next/link";

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const isBanned = reason === "banned";

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-3 font-display text-2xl font-medium">
        {isBanned ? "Account banned" : "Account suspended"}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {isBanned
          ? "This account has been permanently banned from LinkLazy. If you believe this is a mistake, contact support."
          : "This account is temporarily suspended. If you believe this is a mistake, contact support."}
      </p>
      <Link href="/contact" className="text-sm text-brand-blue underline">
        Contact support
      </Link>
    </main>
  );
}
