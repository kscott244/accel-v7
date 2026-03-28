// ─── TERRITORY KNOWLEDGE LAYER ───────────────────────────────────────────────
// Builds a compact, structured knowledge snapshot from all available data
// sources so the AI copilot can answer deep territory questions.
//
// Design principles:
//   1. Pre-compute indexes at build time — don't search linearly at query time
//   2. Never pass raw account arrays to the LLM — too large, hallucination risk
//   3. Enrich each account once with Badger + overlay signals
//   4. Geography indexed by city (exact) and state
//   5. Product family indexed by L3 name prefix mapping

// ── Product family classifier ─────────────────────────────────────
export const PRODUCT_FAMILIES: Record<string, string[]> = {
  COMPOSITE:        ["SIMPLISHADE","HARMONIZE","SONICFILL","HERCULITE","POINT 4","PREMISE","FLOW-IT","VERTISE"],
  BOND:             ["OPTIBOND","BOND-1"],
  CEMENT:           ["MAXCEM","NX3","NEXUS","SIMILE","CEMENT IT"],
  INFECTION_CONTROL:["CAVIWIPES","CAVICIDE"],
  TEMP_CEMENT:      ["TEMPBOND"],
  RMGI:             ["BREEZE","NEXUS RMGI"],
  DESENSITIZER:     ["EMPOWER"],
  CURING_LIGHT:     ["DEMI"],
};

export function prodFamily(productName: string): string | null {
  const u = productName.toUpperCase();
  for (const [fam, keywords] of Object.entries(PRODUCT_FAMILIES)) {
    if (keywords.some(k => u.includes(k))) return fam;
  }
  return null;
}

// Match a product name against a command product/family string
// Returns true if the product matches the requested product or family
export function matchProdCmd(prodName: string, cmdProduct?: string | null, cmdFamily?: string | null): boolean {
  if (!cmdProduct && !cmdFamily) return true;
  const u = prodName.toUpperCase();
  if (cmdProduct && u.includes(cmdProduct.toUpperCase())) return true;
  if (cmdFamily) {
    const keywords = PRODUCT_FAMILIES[cmdFamily.toUpperCase()] || [];
    if (keywords.some(k => u.includes(k))) return true;
  }
  return false;
}

// ── Enriched account ──────────────────────────────────────────────
export interface EnrichedAccount {
  id: string;
  name: string;
  city: string;
  st: string;
  addr: string;
  dealer: string;
  tier: string;
  class2: string;
  gName: string;
  gId: string;
  last: number;
  lat?: number;
  lng?: number;
  // Financials
  py1: number;
  cy1: number;
  gap: number;
  ret: number;
  // Product width (# distinct products with CY > 0)
  prodWidth: number;
  // Enrichment from Badger + overlays
  doctor?: string;
  phone?: string;
  dealerRep?: string;
  feel?: number;
  feelLabel?: "Cold" | "Warm" | "Hot";
  notes?: string;
  visitNotes?: string;
  // Contact from overlays.contacts
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  // Activity / tasks
  lastActivityDays?: number;
  openTaskCount?: number;
  // Raw products array preserved for filtering
  products: any[];
}

// ── Haversine distance (km) ───────────────────────────────────────
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Territory context builder ─────────────────────────────────────
export interface TerritoryContext {
  accounts: EnrichedAccount[];               // all enriched accounts
  byCity: Record<string, EnrichedAccount[]>; // city.toLowerCase() → accounts
  bySt:   Record<string, EnrichedAccount[]>; // state → accounts
  byDealer: Record<string, EnrichedAccount[]>;
  byTier:   Record<string, EnrichedAccount[]>;
  byClass2: Record<string, EnrichedAccount[]>;
  // Aggregate signals
  totalPY1: number;
  totalCY1: number;
  totalGap: number;
  topProducts: Array<{ name: string; cy: number; py: number; family: string | null }>;
}

export function buildTerritoryContext(
  scored: any[],
  badger: Record<string, any>,
  overlays: any,
  officeFeel?: Record<string, any>
): TerritoryContext {
  const today = Date.now();

  // Pre-compute open tasks per account
  const tasksByAcct: Record<string, number> = {};
  for (const t of (overlays?.tasks || [])) {
    if (!t.completed && t.accountId) {
      tasksByAcct[t.accountId] = (tasksByAcct[t.accountId] || 0) + 1;
    }
  }

  // Pre-compute last activity per account
  const lastActByAcct: Record<string, number> = {};
  for (const [aid, logs] of Object.entries(overlays?.activityLogs || {})) {
    const entries = (logs as any[]);
    if (entries.length > 0) {
      const newest = entries[0]; // already sorted newest-first
      if (newest.ts) {
        const days = Math.round((today - new Date(newest.ts).getTime()) / 86400000);
        lastActByAcct[aid] = days;
      }
    }
  }

  // Build enriched accounts
  const accounts: EnrichedAccount[] = scored
    .filter(a => (a.pyQ?.["1"] || 0) > 0 || (a.cyQ?.["1"] || 0) > 0)
    .map(a => {
      const b = badger[a.id] || badger[a.gId] || null;
      const py1 = a.pyQ?.["1"] || 0;
      const cy1 = a.cyQ?.["1"] || 0;
      const gap = Math.max(0, py1 - cy1);
      const ret = py1 > 0 ? cy1 / py1 : 0;
      const prodWidth = (a.products || []).filter((p: any) => (p.cy1 || 0) > 0).length;

      // Feel from officeFeel or direct Badger
      let feel: number | undefined;
      let feelLabel: "Cold" | "Warm" | "Hot" | undefined;
      const rawFeel = b?.feel;
      if (rawFeel != null) {
        feel = parseFloat(rawFeel);
        feelLabel = feel >= 4 ? "Hot" : feel >= 3 ? "Warm" : "Cold";
      }

      // Contact from overlays
      const oc = overlays?.contacts?.[a.id];
      const contactName = oc?.contactName || oc?.contacts?.[0]?.name;
      const contactPhone = oc?.phone || oc?.contacts?.[0]?.phone;
      const contactEmail = oc?.email || oc?.contacts?.[0]?.email;

      return {
        id: a.id,
        name: a.name,
        city: a.city || "",
        st: a.st || "",
        addr: a.addr || "",
        dealer: a.dealer || "All Other",
        tier: a.tier || a.gTier || "Standard",
        class2: a.class2 || "",
        gName: a.gName || "",
        gId: a.gId || "",
        last: a.last || 999,
        lat: b?.lat,
        lng: b?.lng,
        py1, cy1, gap, ret, prodWidth,
        doctor: b?.doctor || undefined,
        phone: b?.phone || undefined,
        dealerRep: b?.dealerRep || undefined,
        feel, feelLabel,
        notes: b?.notes || undefined,
        visitNotes: b?.visitNotes || undefined,
        contactName, contactPhone, contactEmail,
        lastActivityDays: lastActByAcct[a.id],
        openTaskCount: tasksByAcct[a.id] || 0,
        products: a.products || [],
      };
    });

  // Build indexes
  const byCity: Record<string, EnrichedAccount[]> = {};
  const bySt:   Record<string, EnrichedAccount[]> = {};
  const byDealer: Record<string, EnrichedAccount[]> = {};
  const byTier:   Record<string, EnrichedAccount[]> = {};
  const byClass2: Record<string, EnrichedAccount[]> = {};

  for (const a of accounts) {
    const cityKey = (a.city || "").toLowerCase();
    if (cityKey) { byCity[cityKey] = byCity[cityKey] || []; byCity[cityKey].push(a); }
    const stKey = (a.st || "").toUpperCase();
    if (stKey) { bySt[stKey] = bySt[stKey] || []; bySt[stKey].push(a); }
    byDealer[a.dealer] = byDealer[a.dealer] || []; byDealer[a.dealer].push(a);
    byTier[a.tier] = byTier[a.tier] || []; byTier[a.tier].push(a);
    const c2 = (a.class2 || "STANDARD").toUpperCase();
    byClass2[c2] = byClass2[c2] || []; byClass2[c2].push(a);
  }

  // Top products by CY across territory
  const prodMap: Record<string, { cy: number; py: number }> = {};
  for (const a of accounts) {
    for (const p of a.products) {
      if (!prodMap[p.n]) prodMap[p.n] = { cy: 0, py: 0 };
      prodMap[p.n].cy += p.cy1 || 0;
      prodMap[p.n].py += p.py1 || 0;
    }
  }
  const topProducts = Object.entries(prodMap)
    .sort(([,a],[,b]) => b.cy - a.cy)
    .slice(0, 30)
    .map(([name, vals]) => ({ name, ...vals, family: prodFamily(name) }));

  const totalPY1 = accounts.reduce((s, a) => s + a.py1, 0);
  const totalCY1 = accounts.reduce((s, a) => s + a.cy1, 0);
  const totalGap = accounts.reduce((s, a) => s + a.gap, 0);

  return { accounts, byCity, bySt, byDealer, byTier, byClass2, totalPY1, totalCY1, totalGap, topProducts };
}
