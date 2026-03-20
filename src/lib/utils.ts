import type { Q1Signal, VisitPriority, SignalConfig } from "@/types";

// ═══════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════

export function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function fmtPhone(p: string): string {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

export function fmtNumber(n: number): string {
  return n.toLocaleString();
}

// ═══════════════════════════════════════════════════════════
// QUARTER HELPERS
// ═══════════════════════════════════════════════════════════

export function currentQuarter(): number {
  const m = new Date().getMonth();
  return Math.floor(m / 3) + 1;
}

export function daysLeftInQuarter(q: number): number {
  const year = new Date().getFullYear();
  const ends: Record<number, Date> = {
    1: new Date(year, 2, 31),
    2: new Date(year, 5, 30),
    3: new Date(year, 8, 30),
    4: new Date(year, 11, 31),
  };
  const end = ends[q];
  if (!end) return 0;
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// ═══════════════════════════════════════════════════════════
// SIGNAL SYSTEM
// ═══════════════════════════════════════════════════════════

export const SIGNAL_CONFIG: Record<Q1Signal, SignalConfig> = {
  ON_TRACK: {
    label: "On Track",
    color: "#34d399",
    bgColor: "rgba(52,211,153,.09)",
    borderColor: "rgba(52,211,153,.22)",
  },
  LIGHT: {
    label: "Light",
    color: "#fbbf24",
    bgColor: "rgba(251,191,36,.09)",
    borderColor: "rgba(251,191,36,.22)",
  },
  BEHIND: {
    label: "Behind Pace",
    color: "#f87171",
    bgColor: "rgba(248,113,113,.09)",
    borderColor: "rgba(248,113,113,.22)",
  },
  OVERDUE: {
    label: "Overdue",
    color: "#ef4444",
    bgColor: "rgba(239,68,68,.12)",
    borderColor: "rgba(239,68,68,.25)",
  },
  INACTIVE: {
    label: "Inactive",
    color: "#5c5c7a",
    bgColor: "rgba(92,92,122,.09)",
    borderColor: "rgba(92,92,122,.22)",
  },
  NEW_Q1: {
    label: "New Q1",
    color: "#a78bfa",
    bgColor: "rgba(167,139,250,.09)",
    borderColor: "rgba(167,139,250,.22)",
  },
  WATCH: {
    label: "Watch",
    color: "#22d3ee",
    bgColor: "rgba(34,211,238,.09)",
    borderColor: "rgba(34,211,238,.22)",
  },
};

export const VP_CONFIG: Record<string, { label: string; color: string }> = {
  NOW: { label: "Visit Now", color: "#f87171" },
  SOON: { label: "Visit Soon", color: "#fbbf24" },
  PROTECT: { label: "On Track", color: "#34d399" },
  MONITOR: { label: "Monitor", color: "#9898b8" },
  PIPELINE: { label: "Pipeline", color: "#5c5c7a" },
};

// ═══════════════════════════════════════════════════════════
// QUOTA CONSTANTS
// ═══════════════════════════════════════════════════════════

export const Q_TARGETS: Record<number, number> = {
  1: 778915,
  2: 798328,
  3: 793897,
  4: 786954,
};

export const Q_PY_CREDITED: Record<number, number> = {
  1: 690494,
  2: 707703,
  3: 703775,
  4: 697621,
};

export const Q_CY_ACTUAL: Record<number, number> = {
  1: 628609,
  2: 0,
  3: 0,
  4: 0,
};

export const FULL_YEAR_TARGET = 3158094;
export const FULL_YEAR_PY = 2799593;
export const RECOVERABLE = 155160;
export const RECOVER_PY = 2134766;
export const GROW_CY = 139037;

export const ZONE_SCHEDULE: Record<string, string> = {
  Tuesday: "Central CT + Hartford",
  Wednesday: "New Haven + Fairfield + Westchester",
  Thursday: "Hudson Valley + RI + East CT",
};

// ═══════════════════════════════════════════════════════════
// CLASSNAME HELPER
// ═══════════════════════════════════════════════════════════

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
