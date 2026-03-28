// ─── DESIGN TOKENS ───────────────────────────────────────────────
// Single source of truth for all colors used in AccelerateApp inline styles.
// Import T from here anywhere you need a color token.

export const T = {
  bg: "#0a0a0f", s1: "#12121a", s2: "#1a1a25", s3: "#222230", s4: "#2a2a3a",
  b1: "rgba(255,255,255,.06)", b2: "rgba(255,255,255,.08)", b3: "rgba(255,255,255,.04)",
  t1: "#f0f0f5", t2: "#c8c8d0", t3: "#a0a0b8", t4: "#7878a0",
  blue: "#4f8ef7", cyan: "#22d3ee", green: "#34d399", amber: "#fbbf24",
  red: "#f87171", purple: "#a78bfa", orange: "#fb923c",
};

// ─── APP CONSTANTS ────────────────────────────────────────────────

// Per-quarter credited wholesale targets for FY2026
export const QUARTER_TARGETS: Record<string, number> = {
  "1": 778915,
  "2": 789602,
  "3": 794888,
  "4": 794689,
};

// Quarter end dates — used for daysLeftInQuarter()
const QUARTER_END: Record<string, Date> = {
  "1": new Date(2026, 2, 31),
  "2": new Date(2026, 5, 30),
  "3": new Date(2026, 8, 30),
  "4": new Date(2026, 11, 31),
};

export const Q1_TARGET = QUARTER_TARGETS["1"];
export const FY_TARGET = Object.values(QUARTER_TARGETS).reduce((s, v) => s + v, 0);

// Returns days remaining until end of the given quarter
export function daysLeftInQuarter(q: string = "1"): number {
  const end = QUARTER_END[q] || QUARTER_END["1"];
  return Math.max(0, Math.ceil((end.getTime() - new Date().getTime()) / 86400000));
}

// Legacy constant — kept for backward compat with callers that haven't adopted daysLeftInQuarter()
export const DAYS_LEFT = daysLeftInQuarter("1");

// Returns the effective target for a quarter — localStorage override wins over hardcoded default.
// Ken sets Q2+ targets via Admin → Settings when he receives them from Kerr.
export function getQuarterTarget(q: string): number {
  if (typeof window !== "undefined") {
    try {
      const overrides = JSON.parse(localStorage.getItem("quarter_targets") || "{}");
      if (overrides[q] && overrides[q] > 0) return overrides[q];
    } catch {}
  }
  return QUARTER_TARGETS[q] || QUARTER_TARGETS["1"];
}

// Returns which quarter is currently active based on today's date
// Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
export function currentCalendarQuarter(): string {
  const m = new Date().getMonth(); // 0-indexed
  if (m <= 2) return "1";
  if (m <= 5) return "2";
  if (m <= 8) return "3";
  return "4";
}

// Human-readable quarter label, e.g. "Q2 2026"
export function quarterLabel(q: string): string {
  return `Q${q} 2026`;
}

// Thomaston CT home base coordinates — used for distance scoring in Overdrive
export const HOME_LAT = 41.6723;
export const HOME_LNG = -73.0720;
