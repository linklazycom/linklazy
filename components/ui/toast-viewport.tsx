"use client";

import { CheckCircle2, X, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToastItem, ToastTone } from "@/components/ui/toast-provider";

const TONE_STYLES: Record<ToastTone, { icon: typeof Info; wrap: string; iconWrap: string }> = {
  success: {
    icon: CheckCircle2,
    wrap: "border-signal/30 bg-signal-soft",
    iconWrap: "text-signal",
  },
  error: {
    icon: AlertCircle,
    wrap: "border-red-200 bg-red-50",
    iconWrap: "text-red-600",
  },
  warning: {
    icon: AlertTriangle,
    wrap: "border-amber/40 bg-amber-soft",
    iconWrap: "text-amber",
  },
  info: {
    icon: Info,
    wrap: "border-line bg-white",
    iconWrap: "text-brand-violet",
  },
};

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const style = TONE_STYLES[t.tone];
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-chip border p-3.5 shadow-lg",
              "animate-toast-in",
              style.wrap
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.iconWrap)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-sm text-muted">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 rounded-chip p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
