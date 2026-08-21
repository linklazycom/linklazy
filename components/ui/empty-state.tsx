import type { LucideIcon } from "lucide-react";
import { SearchX, Inbox, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Shared empty-state visual for "no results" / "nothing here yet" spots
 * across browse, dashboard lists, admin tables, etc. Drop-in replacement
 * for plain <p>No sites found</p>-style messages.
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-chip border border-dashed border-line bg-paper px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
        <Icon className="h-6 w-6 text-muted" />
      </div>
      <div>
        <p className="font-display text-base font-medium text-ink">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Preset for "no results match your filters/search" contexts. */
export function NoResultsEmptyState({ description, action }: { description?: string; action?: React.ReactNode }) {
  return (
    <EmptyState
      icon={SearchX}
      title="No results found"
      description={description ?? "Try adjusting your filters or search and try again."}
      action={action}
    />
  );
}

/** Preset for "you have no items yet" contexts (orders, watchlist, tickets, etc). */
export function NothingYetEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <EmptyState icon={PackageOpen} title={title} description={description} action={action} />;
}
