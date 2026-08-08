import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, className, id, ...props }, ref) => {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm text-muted">
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal",
            className
          )}
          {...props}
        />
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    );
  }
);
Field.displayName = "Field";

export { Field };
