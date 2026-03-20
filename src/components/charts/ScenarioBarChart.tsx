"use client";

interface ScenarioItem {
  label: string;
  value: number;
  color: string;
  sub?: string;
}

interface ScenarioBarChartProps {
  items: ScenarioItem[];
  target: number;
  valueFormatter?: (val: number) => string;
}

export function ScenarioBarChart({
  items,
  target,
  valueFormatter = (v) => `$${(v / 1000000).toFixed(2)}M`,
}: ScenarioBarChartProps) {
  const maxVal = Math.max(target * 1.1, ...items.map((i) => i.value));

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = (item.value / maxVal) * 100;
        const targetPct = (target / maxVal) * 100;
        const meetsTarget = item.value >= target;

        return (
          <div key={idx}>
            <div className="mb-[5px] flex items-baseline justify-between">
              <span className="text-[11px] font-medium text-t2">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="mono text-[12px] font-bold" style={{ color: item.color }}>
                  {valueFormatter(item.value)}
                </span>
                {meetsTarget && (
                  <span className="text-[9px] text-accent-green">✓</span>
                )}
              </div>
            </div>
            <div className="relative h-[24px] w-full overflow-hidden rounded-sm bg-s3">
              <div
                className="h-full rounded-sm transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${item.color}88, ${item.color})`,
                }}
              />
              {/* Target line */}
              <div
                className="absolute top-0 h-full w-[2px]"
                style={{
                  left: `${targetPct}%`,
                  background: "var(--t3)",
                  opacity: 0.6,
                }}
              />
            </div>
            {item.sub && (
              <div className="mt-1 text-[9px] text-t4">{item.sub}</div>
            )}
          </div>
        );
      })}
      <div className="mt-1 text-[9px] text-t4">
        Vertical line = ${(target / 1000000).toFixed(2)}M target
      </div>
    </div>
  );
}
