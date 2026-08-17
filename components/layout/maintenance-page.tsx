import { Logo } from "@/components/ui/logo";
import { Wrench } from "lucide-react";

/**
 * Shown site-wide (instead of the normal page) when maintenance_mode is
 * "on" in site_settings, for every visitor except logged-in admins.
 * Rendered from app/layout.tsx.
 */
export function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-4 text-center">
      <Logo />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
        <Wrench className="h-7 w-7 text-brand-violet" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">
          আমরা কিছু উন্নতি করছি
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          LinkLazy এই মুহূর্তে সাময়িক মেইনটেন্যান্সে আছে। দ্রুতই ফিরে আসছি — একটু পর আবার
          চেষ্টা করুন।
        </p>
      </div>
    </div>
  );
}
