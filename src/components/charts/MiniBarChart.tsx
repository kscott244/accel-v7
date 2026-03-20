"use client";

interface MiniBarChartProps {
  pyValue: number;
  cyValue: number;
  maxValue: number;
}

export function MiniBarChart({ pyValue, cyValue, maxValue }: MiniBarChartProps) {
  const pyPct = maxValue > 0 ? (pyValue / maxValue) * 100 : 0;
  const cyPct = maxValue > 0 ? (cyValue / maxValue) * 100 : 0;

  return (
    <div className="flex flex-col gap-[3px]">
      <div className="flex items-center gap-2">
        <span className="w-5 text-[8px] text-t4">PY</span>
        <div className="h-[10px] flex-1 overflow-hidden rounded-sm bg-s3">
          <div
            className="h-full rounded-sm bg-t4 opacity-40"
            style={{ width: `${pyPct}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-5 text-[8px] text-accent-blue">CY</span>
        <div className="h-[10px] flex-1 overflow-hidden rounded-sm bg-s3">
          <div
            className="h-full rounded-sm"
            style={{
              width: `${cyPct}%`,
              background: "linear-gradient(90deg, #4f8ef7, #22d3ee)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
