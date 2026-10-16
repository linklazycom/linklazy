import type { DailyPoint } from "@/lib/analytics/format";

/** Dependency-free SVG bar chart of clicks per day (server-rendered). */
export function ClicksBarChart({ data }: { data: DailyPoint[] }) {
  const W = 720;
  const H = 180;
  const PAD = { top: 10, right: 8, bottom: 22, left: 34 };
  const max = Math.max(1, ...data.map((d) => d.clicks));
  const niceMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(1, slot * 0.7);
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Clicks per day" className="w-full">
      {ticks.map((t) => {
        const y = PAD.top + innerH - (t / niceMax) * innerH;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#E4E1F0" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#6B7280">
              {Math.round(t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.clicks / niceMax) * innerH;
        const x = PAD.left + i * slot + (slot - barW) / 2;
        return (
          <g key={d.day}>
            <title>{`${d.day}: ${d.clicks} clicks, ${d.uniques} unique`}</title>
            <rect x={x} y={PAD.top + innerH - h} width={barW} height={Math.max(h, d.clicks > 0 ? 1 : 0)} rx="2" fill="#6D35F9" />
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#6B7280">
                {d.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
