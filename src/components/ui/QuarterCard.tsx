"use client";

import { cn } from "@/lib/utils";

interface QuarterCardProps {
  quarter: string;
  value: string;
  isActive?: boolean;
  sub?: string;
  accentColor?: string;
}

export function QuarterCard({ quarter, value, isActive = false, sub, accentColor }: QuarterCardProps) {
  return (
    <div
      className={cn(
        "rounded-[10px] p-[8px_6px] text-center transition-all duration-200",
        isActive
          ? "border"
          : "border border-b2 bg-s2"
      )}
      style={
        isActive
          ? {
              background: accentColor ? `${accentColor}18` : "rgba(79,142,247,.12)",
              borderColor: accentColor ? `${accentColor}40` : "rgba(79,142,247,.25)",
            }
          : undefined
      }
    >
      <div
        className="mb-[3px] text-[8px] font-bold uppercase"
        style={{ color: isActive ? (accentColor || "var(--blue)") : "var(--t3)" }}
      >
        {quarter}
        {isActive && " ← NOW"}
      </div>
      <div
        className="mono text-[13px] font-extrabold"
        style={{ color: isActive ? "var(--t1)" : "var(--t3)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-[2px] text-[9px] text-t3">{sub}</div>
      )}
    </div>
  );
}
