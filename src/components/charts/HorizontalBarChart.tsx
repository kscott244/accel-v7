"use client";

interface BarItem {
  label: string;
  value: number;
  color: string;
  sub?: string;
}

interface HorizontalBarChartProps {
  items: BarItem[];
  maxValue?: number;
  showValues?: boolean;
  valueFormatter?: (val: number) => string;
  height?: number;
}

export function HorizontalBarChart({
  items,
  maxValue,
  showValues = true,
  valueFormatter = (v) => v.toLocaleString(),
  height = 22,
}: HorizontalBarChartProps) {
  const max = maxValue || Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-[10px]">
      {items.map((item, idx) => (
        <div key={idx}>
          <div className="mb-[4px] flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-t2">{item.label}</span>
              {item.sub && (
                <span className="text-[9px] text-t4">{item.sub}</span>
              )}
            </div>
            {showValues && (
              <span className="mono text-[11px] font-semibold" style={{ color: item.color }}>
                {valueFormatter(item.value)}
              </span>
            )}
          </div>
          <div
            className="w-full overflow-hidden rounded-sm"
            style={{ height, background: "var(--s3)" }}
          >
            <div
              className="h-full rounded-sm transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(1, (item.value / max) * 100)}%`,
                background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
