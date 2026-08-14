"use client";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency/currency-provider";

interface MetricChipProps {
  label: string;
  value: string | number;
  tone?: "default" | "verified" | "price";
  className?: string;
}

/**
 * The recurring "verified ledger" motif used across site cards, order
 * timelines, and dashboards: a small monospace chip pairing a label
 * with a value (DA 42, DR 38, 12K/mo, ৳1,200).
 */
export function MetricChip({ label, value, tone = "default", className }: MetricChipProps) {
  const { currency, rate } = useCurrency();
  const formattedValue = tone === "price" && typeof value === "number" ? currency === "USD" ? `$${(value / rate).toFixed(2)}` : `৳${value.toLocaleString()}` : value;
  return (
    <span
      className={cn("metric-chip", className)}
      data-tone={tone === "default" ? undefined : tone}
    >
      <span className="text-muted">{label}</span>
      <span className="font-medium">{formattedValue}</span>
    </span>
  );
}
