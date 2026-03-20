"use client";

import type { Office } from "@/types";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { fmtK, fmtPhone, VP_CONFIG } from "@/lib/utils";

interface OfficeCardProps {
  office: Office;
  onClick: (office: Office) => void;
}

export function OfficeCard({ office, onClick }: OfficeCardProps) {
  const vpConfig = VP_CONFIG[office.visitPriority] || VP_CONFIG.MONITOR;
  const isNow = office.visitPriority === "NOW";
  const isSoon = office.visitPriority === "SOON";
  const isExpansion = office.isExpansion;

  const retPct = office.py > 0
    ? ((office.cy / office.py) * 100).toFixed(0)
    : "0";

  return (
    <button
      onClick={() => onClick(office)}
      className="w-full text-left transition-all duration-200 active:scale-[.98]"
      style={{
        background: isExpansion ? "rgba(167,139,250,.04)" : "var(--s1)",
        border: `1px solid ${isExpansion ? "rgba(167,139,250,.15)" : isNow ? "rgba(248,113,113,.18)" : isSoon ? "rgba(251,191,36,.14)" : "var(--b1)"}`,
        borderRadius: "14px",
        padding: "14px 16px",
        marginBottom: "8px",
        boxShadow: isNow
          ? "0 0 0 1px rgba(248,113,113,.18), 0 4px 24px rgba(248,113,113,.08)"
          : isSoon
          ? "0 0 0 1px rgba(251,191,36,.14), 0 4px 16px rgba(251,191,36,.06)"
          : "none",
      }}
    >
      {/* Top row */}
      <div className="mb-[6px] flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-t1">
            {office.name}
          </div>
          <div className="mt-[2px] text-[10px] text-t3">
            {office.mainDoctor && <span>{office.mainDoctor} · </span>}
            {office.city}, {office.state}
            {office.phone && (
              <span className="ml-1 text-t4"> · {fmtPhone(office.phone)}</span>
            )}
          </div>
          {!office.isPrivate && (
            <div className="mt-[1px] truncate text-[9px] text-t4">
              ↳ {office.parent}
            </div>
          )}
        </div>
        <SignalBadge signal={office.q1_signal} />
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[8px] uppercase text-t4">PY</div>
          <div className="mono text-[12px] font-bold text-t2">{fmtK(office.py)}</div>
        </div>
        <div>
          <div className="text-[8px] uppercase text-t4">CY</div>
          <div className="mono text-[12px] font-bold text-accent-blue">{fmtK(office.cy)}</div>
        </div>
        {office.gap > 0 && (
          <div>
            <div className="text-[8px] uppercase text-t4">Gap</div>
            <div className="mono text-[12px] font-bold text-accent-red">{fmtK(office.gap)}</div>
          </div>
        )}
        {office.py > 0 && (
          <div>
            <div className="text-[8px] uppercase text-t4">Ret%</div>
            <div className="mono text-[12px] font-bold text-t3">{retPct}%</div>
          </div>
        )}
        {(office.daysSince ?? 0) > 0 && (
          <div className="ml-auto">
            <div className="text-[8px] uppercase text-t4">Last Visit</div>
            <div
              className="mono text-[12px] font-bold"
              style={{ color: (office.daysSince ?? 0) > 60 ? "var(--red)" : (office.daysSince ?? 0) > 30 ? "var(--amber)" : "var(--t3)" }}
            >
              {office.daysSince}d
            </div>
          </div>
        )}
      </div>

      {/* Visit priority tag */}
      <div className="mt-[8px] flex items-center gap-2">
        <div
          className="h-[6px] w-[6px] rounded-full"
          style={{ background: vpConfig.color }}
        />
        <span className="text-[9px] font-semibold" style={{ color: vpConfig.color }}>
          {vpConfig.label}
        </span>
        {isExpansion && (
          <span className="rounded-pill bg-[rgba(167,139,250,.09)] border border-[rgba(167,139,250,.2)] px-2 py-[1px] text-[8px] font-bold text-accent-purple">
            🌱 Expansion
          </span>
        )}
        {office.accelLevel && (
          <span className="ml-auto rounded-pill bg-[rgba(245,158,11,.09)] border border-[rgba(245,158,11,.2)] px-2 py-[1px] text-[8px] font-bold text-accent-gold">
            {office.accelLevel}
          </span>
        )}
        {office.email && (
          <span className="text-[9px] text-t4">✉</span>
        )}
      </div>
    </button>
  );
}
