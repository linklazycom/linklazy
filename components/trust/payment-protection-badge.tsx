import Link from "next/link";

export function PaymentProtectionBadge({ className }: { className?: string }) {
  return (
    <Link
      href="/trust"
      className={`inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink ${className ?? ""}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <path
          fillRule="evenodd"
          d="M10 1.5l6.5 2.6v4.4c0 4.4-2.8 8.1-6.5 9.5-3.7-1.4-6.5-5.1-6.5-9.5V4.1L10 1.5zm2.9 5.9a.75.75 0 00-1.06-1.06L9 9.19 7.66 7.85a.75.75 0 10-1.06 1.06l1.87 1.87a.75.75 0 001.06 0l3.37-3.37z"
          clipRule="evenodd"
        />
      </svg>
      Payment held in escrow until you accept delivery
    </Link>
  );
}
