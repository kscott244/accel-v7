// ─── PRIORITY SCORING MODEL ──────────────────────────────────────
// Shared domain logic used across TodayTab, GroupsTab, callbacks, and visit queue.
// Inputs: any account or group object + active quarter key + optional context.
// Outputs: priorityScore (0–100+), priorityReason, priorityBucket, rootStrength.

import { $$ } from "./format";
import { isAccelTier } from "./tier";
import { BADGER } from "./data";

export type PriorityBucket = "Recover" | "Protect" | "Grow" | "Watch";

export interface PriorityResult {
  priorityScore: number;    // raw score — higher = more urgent/valuable
  priorityReason: string;   // top signal driving the score
  priorityBucket: PriorityBucket;
  rootStrength: number;     // 0–100: relationship depth from BADGER data
}

// ─── WEIGHT RATIONALE ────────────────────────────────────────────
// Gap (30): biggest direct revenue signal — if the gap is large, action has ROI
// Retention (25): behavioral health — low retention = structural problem
// Recency (20): temporal urgency — gone dark = high-risk, needs immediate contact
// Size (10): impact multiplier — large accounts amplify all other signals
// Accel eligibility (5): contractual leverage — tier status enables rebate pressure
// Multi-location (5): compounding value — moving one group moves N offices
// Relationship (5): friction reducer — strong BADGER feel = higher close probability
// Proximity / manual boost: context-time modifiers, applied by caller

export function scorePriority(
  item: any,
  activeQ: string,
  opts?: {
    manualBoost?: number;      // 0–10: explicit override boost
    proximityMiles?: number;   // optional distance for route-aware scoring
  }
): PriorityResult {

  // Resolve CY/PY — works for both individual accounts and groups
  const py = item.pyQ?.[activeQ] ?? item._py1 ?? item.py ?? 0;
  const cy = item.cyQ?.[activeQ] ?? item._cy1 ?? item.cy ?? 0;
  const gap = Math.max(0, py - cy);
  const ret = py > 0 ? cy / py : 0;
  const locs = item._locs ?? item.locations ?? 1;
  // `last` = days since last order (individual accounts only; undefined for groups)
  const daysSinceOrder: number | null = item.last !== undefined ? item.last : null;

  const badger = BADGER[item.id] ?? BADGER[item.gId] ?? null;
  const tier = item.gTier ?? item.tier ?? "";

  // ── 1. Gap (0–30 pts) ──────────────────────────────────────────
  let gapPts = 0, gapReason = "";
  if      (gap > 8000) { gapPts = 30; gapReason = `Gap ${$$(gap)}`; }
  else if (gap > 4000) { gapPts = 22; gapReason = `Gap ${$$(gap)}`; }
  else if (gap > 2000) { gapPts = 14; gapReason = `Gap ${$$(gap)}`; }
  else if (gap > 800)  { gapPts =  7; gapReason = `Gap ${$$(gap)}`; }
  else if (gap > 200)  { gapPts =  3; gapReason = `Gap ${$$(gap)}`; }

  // ── 2. Retention (0–25 pts) ────────────────────────────────────
  let retPts = 0, retReason = "";
  if      (py > 500 && ret < 0.05)  { retPts = 25; retReason = "Near-zero retention"; }
  else if (py > 500 && ret < 0.15)  { retPts = 20; retReason = `Critical: ${Math.round(ret*100)}% ret`; }
  else if (py > 200 && ret < 0.30)  { retPts = 14; retReason = `Low: ${Math.round(ret*100)}% ret`; }
  else if (py > 200 && ret < 0.50)  { retPts =  8; retReason = `${Math.round(ret*100)}% ret`; }
  else if (             ret < 0.70)  { retPts =  4; retReason = `${Math.round(ret*100)}% ret`; }

  // ── 3. Recency (0–20 pts, skipped if unknown) ──────────────────
  let recencyPts = 0, recencyReason = "";
  if (daysSinceOrder !== null) {
    if      (daysSinceOrder > 120) { recencyPts = 20; recencyReason = `Gone dark: ${daysSinceOrder}d`; }
    else if (daysSinceOrder > 60)  { recencyPts = 14; recencyReason = `${daysSinceOrder}d since order`; }
    else if (daysSinceOrder > 30)  { recencyPts =  7; recencyReason = `${daysSinceOrder}d since order`; }
  }

  // ── 4. Account size (0–10 pts) ─────────────────────────────────
  let sizePts = 0;
  if      (py > 5000) sizePts = 10;
  else if (py > 2000) sizePts =  7;
  else if (py > 800)  sizePts =  4;
  else if (py > 200)  sizePts =  1;

  // ── 5. Accel eligibility (0–5 pts) ────────────────────────────
  let accelPts = 0;
  const tl = tier.toLowerCase();
  if      (tl.includes("diamond"))                    accelPts = 5;
  else if (tl.includes("plat"))                       accelPts = 4;
  else if (tl.includes("gold") || tl.includes("silver")) accelPts = 2;
  else if (isAccelTier(tier))                         accelPts = 1;

  // ── 6. Multi-location (0–5 pts) ────────────────────────────────
  let multiLocPts = 0;
  if      (locs >= 5) multiLocPts = 5;
  else if (locs >= 3) multiLocPts = 3;
  else if (locs >= 2) multiLocPts = 1;

  // ── 7. Relationship depth / BADGER signal (−5 to +5 pts) ───────
  let badgerPts = 0;
  if (badger) {
    const feel = badger.feel ? parseFloat(badger.feel) : null;
    if (feel !== null) {
      if      (feel >= 4) badgerPts += 3;
      else if (feel <= 2) badgerPts -= 2;
    }
    if (badger.orders)    badgerPts += 1;
    if (badger.dealerRep) badgerPts += 1;
  }

  // ── 8. Proximity (0–5 pts, optional) ──────────────────────────
  let proximityPts = 0;
  if (opts?.proximityMiles !== undefined) {
    const m = opts.proximityMiles;
    if      (m < 20) proximityPts = 5;
    else if (m < 40) proximityPts = 3;
    else if (m < 60) proximityPts = 1;
  }

  // ── 9. Manual boost (0–10 pts) ────────────────────────────────
  const manualPts = Math.min(10, Math.max(0, opts?.manualBoost ?? 0));

  const total = gapPts + retPts + recencyPts + sizePts + accelPts + multiLocPts + badgerPts + proximityPts + manualPts;

  // ── Bucket ─────────────────────────────────────────────────────
  // Grow: beating PY — reward and cross-sell
  // Recover: significantly below PY — intervention needed
  // Protect: partially below PY — at-risk but recoverable
  // Watch: stable, near-PY, or new account
  let bucket: PriorityBucket;
  const isGrowing = cy > py && py > 0;
  const isDark = daysSinceOrder !== null && daysSinceOrder > 60;
  if (isGrowing) {
    bucket = "Grow";
  } else if (ret < 0.50 && (gap > 800 || isDark)) {
    bucket = "Recover";
  } else if (ret >= 0.50 && ret < 0.90 && gap > 300) {
    bucket = "Protect";
  } else {
    bucket = cy > 0 ? "Watch" : "Recover";
  }

  // ── Primary reason (highest-contributing signal) ───────────────
  const signals: [number, string][] = [
    [gapPts, gapReason],
    [retPts, retReason],
    [recencyPts, recencyReason],
    [multiLocPts >= 3 ? 4 : 0, locs >= 3 ? `${locs} locations` : ""],
  ];
  const topSignal = signals.filter(([,r]) => r).sort(([a],[b]) => b - a)[0];
  const reason = topSignal?.[1] ?? (isGrowing ? "Growing — cross-sell" : "Monitor");

  // ── Root Strength (0–100) ──────────────────────────────────────
  // Measures relationship depth: doctor name known, feel score, last visit,
  // dealer rep tied, notes on file, contact details present.
  // High root strength + low retention → relationship exists, product gap → high close prob
  // Low root strength + high retention → buying but relationship thin → protect risk
  let rootStrength = 0;
  if (badger) {
    if (badger.doctor)       rootStrength += 20;
    if (badger.email)        rootStrength += 10;
    if (badger.phone)        rootStrength += 10;
    if (badger.dealerRep)    rootStrength += 15;
    if (badger.notes)        rootStrength += 10;
    if (badger.orders)       rootStrength += 10;
    if (badger.lat && badger.lng) rootStrength += 5;
    const feel = badger.feel ? parseFloat(badger.feel) : null;
    if (feel !== null) {
      if      (feel >= 4) rootStrength += 20;
      else if (feel >= 3) rootStrength += 10;
      else if (feel >= 2) rootStrength += 5;
    }
    if (badger.lastVisit) {
      const daysSince = (Date.now() - new Date(badger.lastVisit).getTime()) / 86400000;
      if      (daysSince < 30)  rootStrength += 10;
      else if (daysSince < 90)  rootStrength += 5;
      else if (daysSince > 180) rootStrength -= 5;
    }
  }
  rootStrength = Math.max(0, Math.min(100, rootStrength));

  return { priorityScore: total, priorityReason: reason, priorityBucket: bucket, rootStrength };
}

// ─── BUCKET STYLES ───────────────────────────────────────────────
// Consistent visual treatment for priority buckets across all views
import { T } from "./tokens";

export const BUCKET_STYLE: Record<PriorityBucket, { color: string; bg: string; border: string; leftAccent: string }> = {
  Recover: { color: T.red,    bg: "rgba(248,113,113,.08)", border: "rgba(248,113,113,.22)", leftAccent: T.red },
  Protect: { color: T.amber,  bg: "rgba(251,191,36,.08)",  border: "rgba(251,191,36,.22)",  leftAccent: T.amber },
  Grow:    { color: T.green,  bg: "rgba(52,211,153,.08)",  border: "rgba(52,211,153,.18)",  leftAccent: T.green },
  Watch:   { color: T.cyan,   bg: "rgba(34,211,238,.08)",  border: "rgba(34,211,238,.12)",  leftAccent: "rgba(200,147,58,.25)" },
};
