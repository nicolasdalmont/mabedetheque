"use client";

export type BarChartDatum = { label: string; value: number };

/**
 * Minimal dependency-free bar chart. Bars are fixed-width so a long series
 * (e.g. one bar per year across five decades) scrolls horizontally instead
 * of being squeezed unreadably thin.
 */
export function BarChart({
  data,
  height = 140,
}: {
  data: BarChartDatum[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d) => (
          <div
            key={d.label}
            className="flex h-full w-7 shrink-0 flex-col items-center justify-end gap-1"
          >
            <span className="text-[10px] tabular-nums text-zinc-400">
              {d.value > 0 ? d.value : ""}
            </span>
            <div
              title={`${d.label} : ${d.value}`}
              className="w-5 rounded-t bg-yellow-400"
              style={{
                height: `${Math.max(d.value > 0 ? 3 : 0, (d.value / max) * (height - 34))}px`,
              }}
            />
            <span className="text-[10px] text-zinc-500">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
