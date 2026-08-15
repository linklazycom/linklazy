"use client";

import { useCurrency } from "./currency-provider";

/**
 * Renders a BDT amount, converting to USD automatically when the user has
 * switched currency (see CurrencyToggle / useCurrency). Use this anywhere a
 * price/amount is shown outside of MetricChip (which already does this
 * conversion itself for tone="price" numeric values).
 */
export function Money({ amount, className }: { amount: number; className?: string }) {
  const { currency, rate } = useCurrency();
  const formatted =
    currency === "USD" ? `$${(amount / rate).toFixed(2)}` : `৳${amount.toLocaleString()}`;
  return <span className={className}>{formatted}</span>;
}
