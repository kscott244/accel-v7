"use client";

import type { RouteStop } from "@/types";
import { fmtK, fmtPhone, VP_CONFIG } from "@/lib/utils";

interface RouteStopCardProps {
  stop: RouteStop;
  index: number;
  visited: boolean;
  onToggleVisit: () => void;
  onDirections: () => void;
}

export function RouteStopCard({ stop, index, visited, onToggleVisit, onDirections }: RouteStopCardProps) {
  const vpConfig = VP_CONFIG[stop.vp] || VP_CONFIG.MONITOR;
  const q1Gap = stop.q1_2025 - stop.q1_2026;

  return (
    <div
      className="mb-2 rounded-lg p-4 transition-all duration-200"
      style={{
        background: visited ? "var(--s2)" : "var(--s1)",
        border: `1px solid ${visited ? "var(--b2)" : stop.vp === "NOW" ? "rgba(248,113,113,.18)" : "var(--b1)"}`,
        opacity: visited ? 0.6 : 1,
      }}
    >
      {/* Top row */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-s3 mono text-[11px] font-bold text-t3">
            {index + 1}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-t1" style={{ textDecoration: visited ? "line-through" : "none" }}>
              {stop.name}
            </div>
            <div className="mt-[2px] text-[10px] text-t3">
              {stop.doctor && <span>{stop.doctor} · </span>}
              {stop.city}, {stop.state}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-[6px] w-[6px] rounded-full" style={{ background: vpConfig.color }} />
          <span className="text-[9px] font-bold" style={{ color: vpConfig.color }}>{vpConfig.label}</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-2 flex items-center gap-3 pl-10">
        <div>
          <span className="text-[8px] text-t4">Q1 PY </span>
          <span className="mono text-[11px] font-bold text-t3">{fmtK(stop.q1_2025)}</span>
        </div>
        <div>
          <span className="text-[8px] text-accent-blue">Q1 CY </span>
          <span className="mono text-[11px] font-bold text-t1">{fmtK(stop.q1_2026)}</span>
        </div>
        <div>
          <span className="text-[8px] text-t4">Gap </span>
          <span className="mono text-[11px] font-bold text-accent-red">{fmtK(q1Gap)}</span>
        </div>
      </div>

      {/* Flag / Intel */}
      {stop.flag && (
        <div className="mb-2 ml-10 rounded-sm bg-s3 p-2 text-[10px] text-t2">
          {stop.flag}
        </div>
      )}

      {stop.intel && (
        <div className="mb-2 ml-10 text-[10px] leading-relaxed text-t3">
          {stop.intel}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pl-10">
        <button
          onClick={onToggleVisit}
          className="rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors"
          style={{
            background: visited ? "rgba(52,211,153,.09)" : "var(--s3)",
            border: `1px solid ${visited ? "rgba(52,211,153,.22)" : "var(--b2)"}`,
            color: visited ? "var(--green)" : "var(--t3)",
          }}
        >
          {visited ? "✓ Visited" : "Mark Visited"}
        </button>

        <button
          onClick={onDirections}
          className="rounded-md bg-s3 border border-b2 px-3 py-1.5 text-[11px] font-semibold text-t3"
        >
          📍 Directions
        </button>

        {stop.phone && (
          <a
            href={`tel:${stop.phone.replace(/\D/g, "")}`}
            className="rounded-md bg-s3 border border-b2 px-3 py-1.5 text-[11px] font-semibold text-t3"
          >
            📞
          </a>
        )}
      </div>
    </div>
  );
}
