"use client";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { QuarterCard } from "@/components/ui/QuarterCard";
import { fmtK, fmtPct, Q_TARGETS, Q_CY_ACTUAL, FULL_YEAR_TARGET, currentQuarter } from "@/lib/utils";

export function FullYearTracker() {
  const cq = currentQuarter();
  const totalCY = Object.values(Q_CY_ACTUAL).reduce((a, b) => a + b, 0);
  const fyPct = FULL_YEAR_TARGET > 0 ? (totalCY / FULL_YEAR_TARGET) * 100 : 0;

  const quarters = [1, 2, 3, 4].map((q) => {
    const actual = Q_CY_ACTUAL[q] || 0;
    const target = Q_TARGETS[q] || 0;
    const pct = target > 0 ? (actual / target) * 100 : 0;

    return {
      label: `Q${q}`,
      value: actual > 0 ? fmtPct(pct) : fmtK(target),
      sub: `${fmtK(actual)} / ${fmtK(target)}`,
      isActive: q === cq,
    };
  });

  return (
    <div className="card mx-4 mt-[10px] p-[14px_16px]">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-t3">
          2026 Full Year
        </div>
        <div className="badge-blue">{fmtPct(fyPct)}</div>
      </div>

      <div className="mb-[10px]">
        <ProgressBar value={fyPct} height={5} showGlow={false} animated />
      </div>

      <div className="grid grid-cols-4 gap-[6px]">
        {quarters.map((q) => (
          <QuarterCard
            key={q.label}
            quarter={q.label}
            value={q.value}
            isActive={q.isActive}
            sub={q.sub}
          />
        ))}
      </div>
    </div>
  );
}
