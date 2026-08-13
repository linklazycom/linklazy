import { cn } from "@/lib/utils";
import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  options: readonly string[];
  placeholder?: string;
}

const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, hint, className, id, options, placeholder, ...props }, ref) => {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm text-muted">
          {label}
        </label>
        <select
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal",
            className
          )}
          {...props}
        >
          <option value="" disabled>
            {placeholder ?? "Select a niche"}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    );
  }
);
SelectField.displayName = "SelectField";

export { SelectField };
