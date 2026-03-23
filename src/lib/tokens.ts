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
export const Q1_TARGET = 778915;
export const FY_TARGET = 3158094;
// Recomputed at import time — always reflects days remaining in Q1 2026
export const DAYS_LEFT = Math.max(0, Math.ceil((new Date(2026, 2, 31).getTime() - new Date().getTime()) / 86400000));

// Thomaston CT home base coordinates — used for distance scoring in Overdrive
export const HOME_LAT = 41.6723;
export const HOME_LNG = -73.0720;
