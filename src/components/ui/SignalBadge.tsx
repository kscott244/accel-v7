"use client";

import type { Q1Signal } from "@/types";
import { SIGNAL_CONFIG } from "@/lib/utils";

interface SignalBadgeProps {
  signal: Q1Signal;
  size?: "sm" | "md";
}

export function SignalBadge({ signal, size = "sm" }: SignalBadgeProps) {
  const config = SIGNAL_CONFIG[signal];
  if (!config) return null;

  const sizeClasses = size === "sm" ? "px-2 py-[2px] text-[9px]" : "px-3 py-1 text-[11px]";

  return (
    <span
      className={`inline-flex items-center rounded-pill font-bold ${sizeClasses}`}
      style={{
        background: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        color: config.color,
      }}
    >
      {config.label}
    </span>
  );
}
