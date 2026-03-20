"use client";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { fmtK, fmtPct, Q_TARGETS, Q_CY_ACTUAL, currentQuarter, daysLeftInQuarter } from "@/lib/utils";

export function QuotaHero() {
  const cq = currentQuarter();
  const target = Q_TARGETS[cq] || 0;
  const actual = Q_CY_ACTUAL[cq] || 0;
  const gap = Math.max(0, target - actual);
  const pct = target > 0 ? (actual / target) * 100 : 0;
  const daysLeft = daysLeftInQuarter(cq);

  // Count urgent from data (static for now)
  const urgentCount = 41;

  return (
    <div className="card-hero mx-4 mt-[14px] p-[20px_20px_16px]">
      <div className="relative z-10">
        <div className="mb-[2px] text-[11px] font-medium text-t3">
          Q{cq} 2026 — Credited Wholesale
        </div>

        <div className="mb-1 flex items-start justify-between">
          <div className="text-[13px] font-medium text-t3">
            Goal {fmtK(target)}
          </div>
          <div className="badge-blue">{fmtPct(pct)}</div>
        </div>

        <div className="my-3">
          <ProgressBar value={pct} showGlow animated />
        </div>

        <div className="grid grid-cols-4">
          <div className="pr-[14px]">
            <div className="text-[9px] font-medium text-t3">Credited</div>
            <div className="mono text-[14px] font-bold text-accent-blue">{fmtK(actual)}</div>
          </div>
          <div className="pr-[14px]">
            <div className="text-[9px] font-medium text-t3">Gap</div>
            <div className="mono text-[14px] font-bold text-accent-red">{fmtK(gap)}</div>
          </div>
          <div className="pr-[14px]">
            <div className="text-[9px] font-medium text-t3">Days Left</div>
            <div className="mono text-[14px] font-bold text-t2">{daysLeft}</div>
          </div>
          <div>
            <div className="text-[9px] font-medium text-t3">Urgent</div>
            <div className="mono text-[14px] font-bold text-accent-red">{urgentCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
