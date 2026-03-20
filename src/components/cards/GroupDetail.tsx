"use client";

import type { Group, ChildOffice } from "@/types";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fmtCurrency, fmtK, fmtPhone, VP_CONFIG } from "@/lib/utils";

interface GroupDetailProps {
  group: Group | null;
  onClose: () => void;
}

export function GroupDetail({ group, onClose }: GroupDetailProps) {
  if (!group) return null;

  const retPct = group.py_total > 0 ? (group.cy_total / group.py_total) * 100 : 0;
  const gap = group.py_total - group.cy_total;

  const sortedChildren = [...(group.children || [])].sort((a, b) => {
    const gapA = a.q1_py - a.q1_cy;
    const gapB = b.q1_py - b.q1_cy;
    return gapB - gapA;
  });

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-bg animate-slide-in-right">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-b1 bg-bg/90 backdrop-blur-xl">
        <div className="flex h-[52px] items-center px-4">
          <button onClick={onClose} className="flex items-center gap-1 text-[14px] font-semibold text-accent-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Groups
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {/* Group Header */}
        <h2 className="mb-1 text-[18px] font-bold leading-tight text-t1">{group.name}</h2>
        <div className="mb-4 text-[12px] text-t3">
          {group.loc_count} locations · {group.acctType}
        </div>

        {/* Summary Card */}
        <div className="card mb-4 p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-t3">Group Summary</div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-[9px] text-t4 mb-1">PY Total</div>
              <div className="mono text-[16px] font-bold text-t2">{fmtK(group.py_total)}</div>
            </div>
            <div>
              <div className="text-[9px] text-t4 mb-1">CY Total</div>
              <div className="mono text-[16px] font-bold text-accent-blue">{fmtK(group.cy_total)}</div>
            </div>
            <div>
              <div className="text-[9px] text-t4 mb-1">Gap</div>
              <div className="mono text-[16px] font-bold text-accent-red">{fmtK(gap)}</div>
            </div>
          </div>
          <div className="text-[9px] text-t3 mb-1">Retention <span className="mono font-bold">{retPct.toFixed(1)}%</span></div>
          <ProgressBar value={retPct} variant={retPct < 50 ? "danger" : "default"} height={5} showGlow={false} />
        </div>

        {/* Children list */}
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-t3">
          Locations ({sortedChildren.length})
        </div>

        {sortedChildren.map((child, idx) => (
          <ChildOfficeCard key={idx} child={child} />
        ))}
      </div>
    </div>
  );
}

function ChildOfficeCard({ child }: { child: ChildOffice }) {
  const vpConfig = VP_CONFIG[child.visitPriority] || VP_CONFIG.MONITOR;
  const q1Gap = child.q1_py - child.q1_cy;

  return (
    <div
      className="mb-2 rounded-md p-3"
      style={{
        background: "var(--s1)",
        border: `1px solid ${child.visitPriority === "NOW" ? "rgba(248,113,113,.15)" : "var(--b1)"}`,
      }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold text-t1">{child.name}</div>
          <div className="text-[10px] text-t3">
            {child.mainDoctor && <span>{child.mainDoctor} · </span>}
            {child.city}, {child.state}
          </div>
        </div>
        <SignalBadge signal={child.q1_signal} />
      </div>

      <div className="flex items-center gap-3 mt-2">
        <div>
          <span className="text-[8px] text-t4">Q1 PY </span>
          <span className="mono text-[11px] font-bold text-t3">{fmtK(child.q1_py)}</span>
        </div>
        <div>
          <span className="text-[8px] text-accent-blue">Q1 CY </span>
          <span className="mono text-[11px] font-bold text-t1">{fmtK(child.q1_cy)}</span>
        </div>
        <div>
          <span className="text-[8px] text-t4">Gap </span>
          <span className="mono text-[11px] font-bold text-accent-red">{fmtK(q1Gap)}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="h-[5px] w-[5px] rounded-full" style={{ background: vpConfig.color }} />
          <span className="text-[9px] font-semibold" style={{ color: vpConfig.color }}>{vpConfig.label}</span>
        </div>
      </div>
    </div>
  );
}
