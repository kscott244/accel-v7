// ═══════════════════════════════════════════════════════════
// ACCELERATE v2 — Type System
// ═══════════════════════════════════════════════════════════

export type Q1Signal =
  | "ON_TRACK"
  | "LIGHT"
  | "BEHIND"
  | "OVERDUE"
  | "INACTIVE"
  | "NEW_Q1"
  | "WATCH";

export type Bucket = "RECOVER" | "GROW" | "PROTECT";

export type VisitPriority =
  | "NOW"
  | "SOON"
  | "PROTECT"
  | "MONITOR"
  | "PIPELINE";

export type AccelLevel = "" | "Diamond" | "Platinum" | "Gold" | "Silver";

export type AccountType = "Standard" | "Top 100" | "Private";

// ── Office (child within a Group) ──
export interface ChildOffice {
  name: string;
  addr: string;
  city: string;
  state: string;
  cms: string[];
  primary_cm: string;
  py: number;
  cy: number;
  acctType: AccountType | string;
  visitPriority: VisitPriority | string;
  q1_signal: Q1Signal;
  q1_py: number;
  q1_cy: number;
  accelLevel: AccelLevel | string;
  phone: string;
  daysSince: number;
  lastVisit: string;
  bucket: Bucket;
  mainDoctor: string;
  email: string;
  isExpansion: boolean;
}

// ── Parent Group ──
export interface Group {
  parent_id: string;
  name: string;
  acctType: string;
  class2: string;
  loc_count: number;
  py_total: number;
  cy_total: number;
  children: ChildOffice[];
}

// ── Territory Office (flat list) ──
export interface Office {
  name: string;
  parent: string;
  parent_id: string;
  isPrivate: boolean;
  isExpansion: boolean;
  py: number;
  cy: number;
  gap: number;
  score: number;
  city: string;
  state: string;
  addr: string;
  zip: string;
  email: string;
  acctType: string;
  opco: string;
  class2: string;
  bucket: Bucket;
  q1_signal: Q1Signal;
  visitPriority: VisitPriority | string;
  topProduct: string;
  childMdmId: string;
  // Legacy fields retained for compatibility (populated from enrichment data when available)
  zone?: string;
  creditEff?: number;
  activity?: string;
  q1_2025?: number;
  q1_2026?: number;
  q1_gap?: number;
  daysSince?: number;
  avgInterval?: number;
  mainDoctor?: string;
  pm?: string;
  dealerRep?: string;
  dealer?: string;
  phone?: string;
  cell?: string;
  badgerNotes?: string;
  accelLevel?: AccelLevel | string;
  accelOpp?: string;
  route?: string;
  followup?: string;
  lat?: number;
  lng?: number;
  lastVisit?: string;
  lastVisitNote?: string;
}

// ── Territory Summary (grand totals including hidden accounts) ──
export interface TerritorySummary {
  grandTotalPY: number;
  grandTotalCY: number;
  totalAccounts: number;
  visibleAccounts: number;
  hiddenAccounts: number;
  hiddenPY: number;
  hiddenCY: number;
  expansionOpps: number;
}

// ── Product ──
export interface Product {
  name: string;
  py: number;
  cy: number;
  growth: number;
  growthPct: number;
}

// ── Route Stop ──
export interface RouteStop {
  name: string;
  city: string;
  state: string;
  zone: string;
  vp: VisitPriority | string;
  py: number;
  cy: number;
  q1_2025: number;
  q1_2026: number;
  phone: string;
  email: string;
  staff: string;
  doctor: string;
  intel: string;
  flag: string;
  lastVisit: string;
  visitNote: string;
  address: string;
  lat: number;
  lng: number;
}

export interface UnplacedStop {
  name: string;
  city: string;
  state: string;
  py: number;
  zone: string;
  phone: string;
  flag: string;
  hasGPS: boolean;
}

export interface WeekRoutes {
  routes: Record<string, RouteStop[]>;
  unplaced: UnplacedStop[];
}

// ── Gap Account ──
export interface GapAccount {
  name: string;
  city: string;
  state: string;
  gap: number;
  pct: number;
  py: number;
  days: number;
}

// ── Quota / Target Config ──
export interface QuarterTargets {
  [quarter: number]: number;
}

// ── Signal Metadata ──
export interface SignalConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

// ── Dashboard Summary ──
export interface TerritoryStats {
  totalOffices: number;
  totalGroups: number;
  accelEnrolled: number;
  diamondCount: number;
  platinumCount: number;
  totalCY: number;
  totalPY: number;
  retentionRate: number;
  signalCounts: Record<Q1Signal, number>;
  bucketCounts: Record<Bucket, number>;
}
