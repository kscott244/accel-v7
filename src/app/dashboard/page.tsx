"use client";

import { useState, useMemo } from "react";
import { computeTerritoryStats, getTopProducts, getBestRetentionProducts, PRODUCTS } from "@/data";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { QuarterCard } from "@/components/ui/QuarterCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { fmtK, fmtPct, fmtNumber, SIGNAL_CONFIG, Q_TARGETS, Q_CY_ACTUAL, currentQuarter } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const stats = useMemo(() => computeTerritoryStats(), []);
  const cq = currentQuarter();
  const target = Q_TARGETS[cq] || 0;
  const actual = Q_CY_ACTUAL[cq] || 0;
  const gap = target - actual;
  const pct = target > 0 ? (actual / target) * 100 : 0;

  const [prodView, setProdView] = useState<"cy" | "best">("cy");

  const topProducts = useMemo(() => {
    if (prodView === "cy") return getTopProducts(10);
    return getBestRetentionProducts(10);
  }, [prodView]);

  // Signal chart data
  const signalOrder: (keyof typeof SIGNAL_CONFIG)[] = ["ON_TRACK", "LIGHT", "BEHIND", "OVERDUE", "INACTIVE", "NEW_Q1"];
  const signalItems = signalOrder
    .filter((sig) => stats.signalCounts[sig])
    .map((sig) => ({
      label: SIGNAL_CONFIG[sig].label,
      value: stats.signalCounts[sig] || 0,
      color: SIGNAL_CONFIG[sig].color,
    }));

  // Bucket data
  const bucketItems = [
    { label: "Recover", value: stats.bucketCounts.RECOVER || 0, color: "#f87171", sub: "Need re-engagement" },
    { label: "Grow", value: stats.bucketCounts.GROW || 0, color: "#34d399", sub: "Active + expanding" },
    { label: "Protect", value: stats.bucketCounts.PROTECT || 0, color: "#4f8ef7", sub: "On track" },
  ];

  // Product chart data
  const prodMaxVal = Math.max(...topProducts.map((p) => (prodView === "cy" ? p.cy : (p.py > 0 ? (p.cy / p.py) * 100 : 0))));
  const prodItems = topProducts.map((p) => ({
    label: p.name,
    value: prodView === "cy" ? p.cy : (p.py > 0 ? (p.cy / p.py) * 100 : 0),
    color: prodView === "cy" ? "#4f8ef7" : "#34d399",
    sub: prodView === "cy" ? `PY ${fmtK(p.py)}` : `${fmtK(p.cy)} / ${fmtK(p.py)}`,
  }));

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-t3">Territory Intelligence</div>
        <div className="mono text-[10px] text-t3">2026 YTD · Q{cq}</div>
      </div>

      {/* ══ QUOTA PULSE ══ */}
      <div className="card-hero mt-3 p-[18px]">
        <div className="relative z-10">
          <div className="mb-[10px] text-[10px] font-bold uppercase tracking-wider text-t3">Q{cq} Quota Pace</div>
          <div className="mb-[6px] flex items-baseline gap-[10px]">
            <div className="mono text-[30px] font-extrabold text-t1">{fmtPct(pct)}</div>
            <div className="text-[12px]" style={{ color: pct >= 90 ? "var(--green)" : pct >= 70 ? "var(--amber)" : "var(--red)" }}>
              {pct >= 90 ? "✓ On Track" : pct >= 70 ? "⚠ Behind" : "🚨 At Risk"}
            </div>
          </div>
          <div className="mb-[14px] text-[11px] text-t3">
            {fmtK(actual)} credited · {fmtK(target)} target · <span className="text-accent-red">-{fmtK(gap)} gap</span>
          </div>
          <ProgressBar value={pct} animated />
          {/* Quarter cards */}
          <div className="mt-3 grid grid-cols-4 gap-[6px]">
            {[1, 2, 3, 4].map((q) => (
              <QuarterCard
                key={q}
                quarter={`Q${q}`}
                value={q === cq ? fmtPct(pct) : fmtK(Q_TARGETS[q] || 0)}
                isActive={q === cq}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ══ ACCOUNT HEALTH ══ */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatCard label="Total Offices" value={fmtNumber(stats.totalOffices)} sub={`across ${fmtNumber(stats.totalGroups)} groups`} />
        <StatCard label="On Accelerate" value={String(stats.accelEnrolled)} sub={`${stats.diamondCount} Diamond · ${stats.platinumCount} Platinum`} labelColor="var(--gold)" color="var(--gold)" />
      </div>

      {/* ══ SIGNAL BREAKDOWN ══ */}
      <div className="card mt-3 p-4">
        <SectionHeader
          title="Q1 Account Signals"
          subtitle={`${Object.values(stats.signalCounts).reduce((a, b) => a + b, 0).toLocaleString()} tracked`}
        />
        <HorizontalBarChart items={signalItems} />
      </div>

      {/* ══ BUCKET BREAKDOWN ══ */}
      <div className="card mt-3 p-4">
        <SectionHeader title="Account Priority Buckets" />
        <HorizontalBarChart items={bucketItems} />
      </div>

      {/* ══ PRODUCT PERFORMANCE ══ */}
      <div className="card mt-3 p-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-t3">Top Products</div>
          <div className="flex gap-1">
            <button
              onClick={() => setProdView("cy")}
              className={cn(
                "rounded-pill px-2 py-[3px] text-[9px] font-bold transition-all",
                prodView === "cy"
                  ? "bg-[rgba(79,142,247,.12)] border border-[rgba(79,142,247,.25)] text-accent-blue"
                  : "bg-s3 border border-b2 text-t3"
              )}
            >
              CY Spend
            </button>
            <button
              onClick={() => setProdView("best")}
              className={cn(
                "rounded-pill px-2 py-[3px] text-[9px] font-bold transition-all",
                prodView === "best"
                  ? "bg-[rgba(52,211,153,.09)] border border-[rgba(52,211,153,.22)] text-accent-green"
                  : "bg-s3 border border-b2 text-t3"
              )}
            >
              Best Retention
            </button>
          </div>
        </div>
        <div className="mb-3 text-[10px] text-t4">YTD vs Prior Year</div>
        <HorizontalBarChart
          items={prodItems}
          valueFormatter={prodView === "cy" ? fmtK : (v) => `${v.toFixed(1)}%`}
          height={18}
        />
      </div>

      {/* ══ TERRITORY SUMMARY ══ */}
      <div className="card mt-3 p-4">
        <SectionHeader title="Total Territory" subtitle="All Products · YTD" />
        <div className="mb-[14px] grid grid-cols-2 gap-[10px]">
          <div>
            <div className="mb-[3px] text-[9px] text-t3">CY Credited</div>
            <div className="mono text-[20px] font-bold text-t1">{fmtK(stats.totalCY)}</div>
          </div>
          <div>
            <div className="mb-[3px] text-[9px] text-t3">PY Same Period</div>
            <div className="mono text-[20px] font-bold text-t2">{fmtK(stats.totalPY)}</div>
          </div>
        </div>
        <div className="mb-[5px] text-[9px] text-t3">
          Retention Rate <span className="mono" style={{ color: stats.retentionRate < 30 ? "var(--red)" : "var(--amber)" }}>{fmtPct(stats.retentionRate)}</span>
        </div>
        <ProgressBar value={stats.retentionRate} variant="danger" height={8} showGlow={false} />
        <div className="mt-1 text-[9px] text-t4">YTD data reflects partial Q1 — full-year comparison pending</div>
      </div>
    </div>
  );
}
