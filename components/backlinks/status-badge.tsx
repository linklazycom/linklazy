import { STATUS_LABEL, STATUS_STYLE, linkTypeChips } from "@/lib/backlinks/labels";
import type { BacklinkStatus } from "@/lib/backlinks/check";

export function StatusBadge({ status }: { status: string }) {
  const s = (status in STATUS_LABEL ? status : "unchecked") as BacklinkStatus;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s]}`}>{STATUS_LABEL[s]}</span>;
}

const TONE = { good: "bg-signal-soft text-signal", warn: "bg-amber-soft text-amber", info: "bg-line/60 text-muted" } as const;

export function LinkTypeChips({ rel, isFollow, pageRobots }: { rel: string | null; isFollow: boolean | null; pageRobots: string | null }) {
  const chips = linkTypeChips(rel, isFollow, pageRobots);
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((c) => (
        <span key={c.label} className={`rounded-full px-2 py-0.5 text-xs ${TONE[c.tone]}`}>
          {c.label}
        </span>
      ))}
    </>
  );
}
