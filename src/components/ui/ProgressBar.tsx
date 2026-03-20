"use client";

import { useEffect, useState } from "react";

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: "default" | "danger" | "green";
  height?: number;
  showGlow?: boolean;
  animated?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  variant = "default",
  height = 6,
  showGlow = true,
  animated = true,
}: ProgressBarProps) {
  const [width, setWidth] = useState(animated ? 0 : Math.min(100, (value / max) * 100));

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setWidth(Math.min(100, (value / max) * 100));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [value, max, animated]);

  const gradients = {
    default: "linear-gradient(90deg, #4f8ef7 0%, #22d3ee 100%)",
    danger: "linear-gradient(90deg, #f87171 0%, #fbbf24 100%)",
    green: "linear-gradient(90deg, #34d399 0%, #22d3ee 100%)",
  };

  return (
    <div
      className="w-full overflow-hidden rounded-pill"
      style={{ height, background: "rgba(255,255,255,.06)" }}
    >
      <div
        className="h-full rounded-pill relative"
        style={{
          width: `${width}%`,
          background: gradients[variant],
          transition: animated ? "width 1.4s cubic-bezier(.16,1,.3,1)" : "none",
        }}
      >
        {showGlow && width > 3 && (
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: height + 4,
              height: height + 4,
              background: variant === "danger" ? "#fbbf24" : "#22d3ee",
              boxShadow: `0 0 0 3px ${variant === "danger" ? "rgba(251,191,36,.2)" : "rgba(34,211,238,.2)"}, 0 0 12px ${variant === "danger" ? "rgba(251,191,36,.5)" : "rgba(34,211,238,.5)"}`,
            }}
          />
        )}
      </div>
    </div>
  );
}
