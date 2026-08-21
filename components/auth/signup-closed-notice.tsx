import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export function SignupClosedNotice() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-paper">
        <LockKeyhole className="h-7 w-7 text-muted" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">
          New signups are temporarily closed
        </h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;re not accepting new accounts right now. If you already have an account, you can
          still log in.
        </p>
      </div>
      <Link
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-chip bg-brand-gradient px-5 text-sm font-medium text-white shadow-sm hover:opacity-90"
      >
        Log in
      </Link>
    </div>
  );
}
