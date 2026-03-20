"use client";

import type { Group } from "@/types";
import { fmtK } from "@/lib/utils";

interface GroupCardProps {
  group: Group;
  onClick: (group: Group) => void;
}

export function GroupCard({ group, onClick }: GroupCardProps) {
  const retPct = group.py_total > 0 ? (group.cy_total / group.py_total) * 100 : 0;
  const gap = group.py_total - group.cy_total;
  const hasUrgent = group.children?.some((c) => c.visitPriority === "NOW");
  const multiDist = group.children?.some((c) => c.cms && c.cms.length > 1);

  return (
    <button
      onClick={() => onClick(group)}
      className="w-full text-left transition-all duration-200 active:scale-[.98]"
      style={{
        background: "var(--s1)",
        border: `1px solid ${hasUrgent ? "rgba(248,113,113,.15)" : "var(--b1)"}`,
        borderRadius: "14px",
        padding: "14px 16px",
        marginBottom: "8px",
      }}
    >
      <div className="mb-[6px] flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-t1">{group.name}</div>
          <div className="mt-[2px] flex items-center gap-2 text-[10px] text-t3">
            <span>{group.loc_count} location{group.loc_count !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{group.acctType}</span>
            {multiDist && (
              <span className="rounded-pill bg-[rgba(167,139,250,.09)] border border-[rgba(167,139,250,.2)] px-[6px] py-[1px] text-[8px] font-bold text-accent-purple">
                📦 Multi-Dist
              </span>
            )}
          </div>
        </div>
        {hasUrgent && (
          <div className="shrink-0 rounded-pill bg-[rgba(248,113,113,.09)] border border-[rgba(248,113,113,.22)] px-2 py-[2px] text-[9px] font-bold text-accent-red">
            Urgent
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div>
          <span className="text-[8px] uppercase text-t4">PY </span>
          <span className="mono text-[12px] font-bold text-t2">{fmtK(group.py_total)}</span>
        </div>
        <div>
          <span className="text-[8px] uppercase text-t4">CY </span>
          <span className="mono text-[12px] font-bold text-accent-blue">{fmtK(group.cy_total)}</span>
        </div>
        <div>
          <span className="text-[8px] uppercase text-t4">Gap </span>
          <span className="mono text-[12px] font-bold text-accent-red">{fmtK(gap)}</span>
        </div>
        <div className="ml-auto">
          <span className="text-[8px] uppercase text-t4">Ret </span>
          <span className="mono text-[12px] font-bold text-t3">{retPct.toFixed(0)}%</span>
        </div>
      </div>
    </button>
  );
}
