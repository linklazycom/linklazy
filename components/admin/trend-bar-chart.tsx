/**
 * Minimal day-by-day bar chart, rendered as plain SVG on the server.
 * No client JS, no chart library — just enough to show a trend at a
 * glance next to the KPI numbers.
 */
export function TrendBarChart({
  data,
  height = 120,
  color = "#2C75FC",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = Math.max(240, data.length * 14);
  const barWidth = Math.max(3, width / data.length - 3);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height + 20} className="block">
        {data.map((d, i) => {
          const barHeight = Math.max(1, (d.value / max) * height);
          const x = i * (width / data.length);
          const y = height - barHeight;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                opacity={0.85}
                rx={1.5}
              >
                <title>
                  {d.label}: {d.value}
                </title>
              </rect>
            </g>
          );
        })}
        <line x1={0} y1={height} x2={width} y2={height} stroke="#E5E1DA" strokeWidth={1} />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
