import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "icon";
  size?: number;
  className?: string;
}

/**
 * The LinkLazy logo. Uses the source PNG for the icon mark (gradient
 * artwork isn't practical to recreate in CSS) and sets the wordmark in
 * text so it stays crisp and theme-aware at any size.
 */
export function Logo({ variant = "full", size = 28, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/logo-mark.png"
        alt=""
        width={size}
        height={size}
        className="shrink-0"
        priority
      />
      {variant === "full" && (
        <span className="font-display text-lg font-semibold leading-none">
          link<span className="brand-gradient-text">lazy</span>
        </span>
      )}
    </span>
  );
}
