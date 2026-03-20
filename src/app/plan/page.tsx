"use client";

import { useState, useMemo } from "react";
import { GAP_ACCOUNTS } from "@/data";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { QuarterCard } from "@/components/ui/QuarterCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ScenarioBarChart } from "@/components/charts/ScenarioBarChart";
import {
  fmtK, fmtCurrency, fmtPct,
  Q_TARGETS, Q_CY_ACTUAL, Q_PY_CREDITED,
  FULL_YEAR_TARGET, FULL_YEAR_PY, RECOVERABLE, RECOVER_PY, GROW_CY,
  currentQuarter, daysLeftInQuarter,
} from "@/lib/utils";

export default function PlanPage() {
  const cq = currentQuarter();
  const cqTarget = Q_TARGETS[cq] || 0;
  const cqActual = Q_CY_ACTUAL[cq] || 0;
  const cqGap = cqTarget - cqActual;
  const totalCY = Object.values(Q_CY_ACTUAL).reduce((a, b) => a + b, 0);
  const fyPct = FULL_YEAR_TARGET > 0 ? (totalCY / FULL_YEAR_TARGET) * 100 : 0;
  const daysLeft = daysLeftInQuarter(cq);

  // Q1 Gap Slider
  const [recoverPct, setRecoverPct] = useState(50);
  const recoverAmount = (RECOVERABLE * recoverPct) / 100;
  const remainingGap = cqGap - recoverAmount;

  // Completion Estimator
  const pyLast12DayRate = 127815; // base PY rate for last 12 days
  const cyRunRate = 8059; // per day
  const [estRate, setEstRate] = useState(100);
  const estAddAmount = (pyLast12DayRate * estRate) / 100;
  const estProjected = cqActual + estAddAmount;
  const estPct = cqTarget > 0 ? (estProjected / cqTarget) * 100 : 0;
  const estGap = estProjected - cqTarget;
  const cyRunRateProj = cqActual + cyRunRate * daysLeft;

  // Gap accounts
  const [showAllGap, setShowAllGap] = useState(false);
  const visibleGap = showAllGap ? GAP_ACCOUNTS : GAP_ACCOUNTS.slice(0, 10);

  // FY Scenario projections
  const fyScenarios = useMemo(() => {
    const baseQ1Est = estProjected;
    const remainQ = [2, 3, 4];

    const calcFY = (recRetention: number) => {
      const recoverFY = RECOVER_PY * recRetention;
      const growFY = GROW_CY * 4; // annualize
      const q1 = baseQ1Est;
      const remaining = remainQ.reduce((sum, q) => sum + (Q_PY_CREDITED[q] || 0) * recRetention + (GROW_CY / 3), 0);
      return q1 + remaining;
    };

    return [
      { label: "Conservative (25%)", value: calcFY(0.25), color: "#f87171", sub: "25% RECOVER retention" },
      { label: "Current Pace (32.6%)", value: calcFY(0.326), color: "#fbbf24", sub: "Current trajectory" },
      { label: "Moderate (35%)", value: calcFY(0.35), color: "#4f8ef7", sub: "35% RECOVER retention" },
      { label: "Stretch (50%)", value: calcFY(0.50), color: "#34d399", sub: "50% RECOVER retention" },
    ];
  }, [estProjected]);

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-t3">2026 Plan</div>
        <div className="mono text-[10px] text-t3">Full Year · Dynamic</div>
      </div>

      {/* ══ FULL YEAR HERO ══ */}
      <div className="card-hero mt-3 p-[18px]">
        <div className="relative z-10">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-t3">
            2026 Full Year Target — Credited Wholesale
          </div>
          <div className="mb-1 flex items-baseline gap-3">
            <div className="mono text-[30px] font-extrabold text-t1">{fmtCurrency(FULL_YEAR_TARGET)}</div>
            <span className="badge-amber">On Watch</span>
          </div>
          <div className="mb-[14px] text-[11px] text-t3">
            PY 2025: {fmtCurrency(FULL_YEAR_PY)} · Required growth: +12.8%
          </div>

          <div className="mb-1 text-[9px] text-t3">
            YTD Pace <span className="mono text-accent-blue">{fmtPct(fyPct)}</span>
          </div>
          <ProgressBar value={fyPct} height={7} animated />

          <div className="mt-[14px] grid grid-cols-4 gap-[6px]">
            {[1, 2, 3, 4].map((q) => {
              const qActual = Q_CY_ACTUAL[q] || 0;
              const qTarget = Q_TARGETS[q] || 0;
              const qPct = qTarget > 0 ? (qActual / qTarget) * 100 : 0;
              return (
                <QuarterCard
                  key={q}
                  quarter={`Q${q}`}
                  value={qActual > 0 ? fmtPct(qPct) : fmtK(qTarget)}
                  isActive={q === cq}
                  sub={`${fmtK(qActual)} / ${fmtK(qTarget)}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ Q1 GAP ANALYSIS ══ */}
      <div className="card mt-3 p-4" style={{ borderColor: "rgba(248,113,113,.22)" }}>
        <div className="mb-[10px] flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent-red">Q1 Gap Analysis</div>
          <div className="mono text-[13px] font-extrabold text-accent-red">-{fmtCurrency(cqGap)}</div>
        </div>

        {/* Slider */}
        <div className="mb-3">
          <div className="mb-[6px] flex items-center justify-between">
            <div className="text-[11px] text-t2">If <em>Behind</em> accounts recover to…</div>
            <div className="mono text-[13px] font-bold text-t1">{recoverPct}%</div>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={recoverPct}
            onChange={(e) => setRecoverPct(Number(e.target.value))}
          />
          <div className="mt-[3px] flex justify-between">
            <span className="text-[9px] text-t4">10% (no change)</span>
            <span className="text-[9px] text-t4">100% (full recovery)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-sm bg-s2 p-[10px_12px]">
          <div>
            <div className="mb-[2px] text-[9px] text-t3">Projected Recovery</div>
            <div className="mono text-[16px] font-extrabold text-t1">{fmtCurrency(Math.round(recoverAmount))}</div>
          </div>
          <div>
            <div className="mb-[2px] text-[9px] text-t3">Remaining Gap</div>
            <div className="mono text-[16px] font-extrabold" style={{ color: remainingGap > 0 ? "var(--red)" : "var(--green)" }}>
              {remainingGap > 0 ? `-${fmtCurrency(Math.round(remainingGap))}` : `+${fmtCurrency(Math.abs(Math.round(remainingGap)))}`}
            </div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-t3">193 unique behind/overdue accounts · {fmtCurrency(RECOVERABLE)} total recoverable Q1 spend</div>
      </div>

      {/* ══ Q1 COMPLETION ESTIMATOR ══ */}
      <div className="card mt-3 p-4" style={{ borderColor: "rgba(79,142,247,.22)" }}>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent-blue">Q1 Completion Estimator</div>
          <div className="mono text-[9px] text-t4">{daysLeft} days left</div>
        </div>
        <div className="mb-[14px] text-[10px] text-t3">
          Assumes accounts that bought in the last 12 days of Q1 last year buy again at the same rate.
        </div>

        {/* Current vs projected */}
        <div className="mb-[14px] grid grid-cols-2 gap-2">
          <div className="rounded-sm bg-s2 p-[10px_12px]">
            <div className="mb-[3px] text-[9px] text-t3">Credited Today</div>
            <div className="mono text-[18px] font-extrabold text-t1">{fmtCurrency(cqActual)}</div>
            <div className="mt-[1px] text-[9px] text-t3">78 of 90 days</div>
          </div>
          <div className="rounded-sm p-[10px_12px]" style={{ background: "rgba(79,142,247,.1)", border: "1px solid rgba(79,142,247,.22)" }}>
            <div className="mb-[3px] text-[9px] text-accent-blue">Est. Final Q1</div>
            <div className="mono text-[18px] font-extrabold text-t1">{fmtCurrency(Math.round(estProjected))}</div>
            <div className="mt-[1px] text-[9px] text-t3">{fmtPct(estPct)} of target</div>
          </div>
        </div>

        {/* Rate slider */}
        <div className="mb-3">
          <div className="mb-[5px] flex items-center justify-between">
            <div className="text-[11px] text-t2">
              Last {daysLeft} days repeat at <span className="font-bold text-t1">{estRate}%</span> of PY rate
            </div>
            <div className="mono text-[10px] text-t3">+{fmtCurrency(Math.round(estAddAmount))}</div>
          </div>
          <input
            type="range"
            min={50}
            max={130}
            value={estRate}
            onChange={(e) => setEstRate(Number(e.target.value))}
          />
          <div className="mt-[3px] flex justify-between">
            <span className="text-[9px] text-t4">50% (slow close)</span>
            <span className="text-[9px] text-t4">130% (strong close)</span>
          </div>
        </div>

        {/* Gap result */}
        <div className="flex items-center justify-between rounded-sm bg-s2 p-[10px_12px]">
          <div>
            <div className="mb-[2px] text-[9px] text-t3">Projected gap vs {fmtK(cqTarget)} target</div>
            <div className="mono text-[16px] font-extrabold" style={{ color: estGap < 0 ? "var(--red)" : "var(--green)" }}>
              {estGap < 0 ? `-${fmtCurrency(Math.abs(Math.round(estGap)))}` : `+${fmtCurrency(Math.round(estGap))}`}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-[2px] text-[9px] text-t3">vs CY run rate projection</div>
            <div className="text-[11px] font-semibold text-t3">
              {fmtK(cyRunRateProj)} <span className="text-[9px]">(-{fmtK(cqTarget - cyRunRateProj)})</span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-[9px] text-t4">
          CY run rate: ${cyRunRate.toLocaleString()}/day · PY last-12-day rate: ~$10,651/day scaled
        </div>
      </div>

      {/* ══ FY PROJECTION SCENARIOS ══ */}
      <div className="card mt-3 p-4">
        <SectionHeader title="Full-Year Projection Scenarios" />
        <div className="mb-3 text-[10px] text-t4">Based on RECOVER account retention rate. GROW accounts add ~$139K baseline.</div>
        <ScenarioBarChart items={fyScenarios} target={FULL_YEAR_TARGET} />
      </div>

      {/* ══ TOP GAP ACCOUNTS ══ */}
      <div className="card mt-3 p-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-t3">Top Q1 Gap Accounts</div>
          <div className="text-[10px] text-t4">by $ gap</div>
        </div>
        <div className="mb-3 text-[10px] text-t4">Behind + Overdue · sorted by recoverable spend</div>

        <div className="space-y-2">
          {visibleGap.map((acct, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-sm bg-s2 p-[10px_12px]">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-t1">{acct.name}</div>
                <div className="text-[9px] text-t3">{acct.city}, {acct.state}</div>
              </div>
              <div className="ml-3 text-right shrink-0">
                <div className="mono text-[12px] font-bold text-accent-red">-{fmtCurrency(acct.gap)}</div>
                <div className="text-[9px] text-t4">
                  {acct.pct > 0 ? `${acct.pct}% ret` : "0% ret"} · {acct.days}d ago
                </div>
              </div>
            </div>
          ))}
        </div>

        {!showAllGap && GAP_ACCOUNTS.length > 10 && (
          <button
            onClick={() => setShowAllGap(true)}
            className="mt-3 w-full rounded-sm bg-s2 border border-b2 py-[10px] text-[11px] font-semibold text-t3"
          >
            Show more accounts
          </button>
        )}
      </div>

      {/* ══ HOW TARGETS BUILT ══ */}
      <div className="card mt-3 p-4">
        <SectionHeader title="How Targets Were Built" />
        <div className="text-[11px] leading-relaxed text-t2">
          PY 2025 raw wholesale → chargebacks by tier (Std/Top100 100%, Silver 80%, Gold 76%, Platinum 70%, Diamond 64%) → credited baseline → scaled ×1.1281 (+12.8%) from Q1 goal.
        </div>
        <div className="mt-[10px] grid grid-cols-4 gap-[6px]">
          {[
            { label: "Q1 PY CB", value: "$25,110" },
            { label: "Q2 PY CB", value: "$28,935" },
            { label: "Q3 PY CB", value: "$27,721" },
            { label: "Q4 PY CB", value: "$28,805" },
          ].map((item) => (
            <div key={item.label} className="rounded-sm bg-s2 p-[8px_4px] text-center">
              <div className="mb-[3px] text-[8px] text-t3">{item.label}</div>
              <div className="mono text-[11px] font-bold text-t2">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-sm bg-s2 p-[10px_12px]">
          <div className="mb-1 text-[10px] font-bold text-accent-amber">SKU Example — OptiBond Universal 360</div>
          <div className="text-[10px] leading-relaxed text-t3">
            Private $107.66 · Silver $86.10 (−$21.56) · Gold $81.82 (−$25.84) · Platinum $75.36 (−$32.30) · Diamond $68.90 (−$38.76)
          </div>
        </div>
      </div>
    </div>
  );
}
