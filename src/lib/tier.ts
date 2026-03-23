// ─── TIER / CHARGEBACK RULES ──────────────────────────────────────
// The Tableau export uses a single "Acct Type" field that conflates two
// separate things: (1) pricing tier and (2) Top 100 spend ranking.
// These rules untangle that permanently so no future upload can break it.
//
// PRICING TIER → chargeback rate:
//   Standard, Top 100, HOUSE ACCOUNTS = 0%  (Top 100 is a ranking, NOT a tier)
//   Top 100-Gold = Gold rate (24%)           (strip the ranking prefix)
//   Top 100-Diamond = Diamond rate (36%)     (strip the ranking prefix)
//   Silver=20%, Gold=24%, Platinum=30%, Diamond=36%
//
// PRACTICE TYPE → comes from Sds Cust Class2, NOT Acct Type:
//   DSO, EMERGING DSO, COMMUNITY HEALTHCARE, GOVERNMENT, SCHOOLS, STANDARD(=Private Practice)

export const ACCEL_RATES: Record<string, number> = {
  Silver: 0.20, Gold: 0.24, Platinum: 0.30, Diamond: 0.36,
};

// Clean pricing tier — strips Top 100 ranking, normalizes everything to 5 values
export const normalizeTier = (raw: any): string => {
  if (!raw) return "Standard";
  const t = (raw as string).trim();
  if (t === "HOUSE ACCOUNTS") return "Standard";
  if (t === "Top 100") return "Standard";
  if (t.startsWith("Top 100-")) return t.split("-")[1];
  if (t in ACCEL_RATES) return t;
  return "Standard";
};

// Is this account in the Top 100 spend ranking? Separate from tier.
export const isTop100 = (raw: any): boolean => {
  if (!raw) return false;
  return (raw as string).trim().startsWith("Top 100");
};

// Practice type from Sds Cust Class2 — this is the RIGHT place for account type
export const normalizePracticeType = (class2: any): string => {
  const c = ((class2 as string) || "").trim().toUpperCase();
  if (c === "DSO") return "DSO";
  if (c === "EMERGING DSO") return "Emerging DSO";
  if (c === "COMMUNITY HEALTHCARE") return "Community Health";
  if (c === "GOVERNMENT") return "Government";
  if (c === "SCHOOLS") return "School";
  return "Private Practice"; // STANDARD → Private Practice
};

export const getTierRate = (tier: any): number => ACCEL_RATES[normalizeTier(tier)] || 0;
export const isAccelTier = (tier: any): boolean => normalizeTier(tier) in ACCEL_RATES;

export const getTierLabel = (tier: any, class2?: any): string => {
  const n = normalizeTier(tier);
  if (n === "Standard") return normalizePracticeType(class2);
  return `Accelerate ${n}`;
};

// ─── GROUP NAME RULES ─────────────────────────────────────────────
// Parent Name field always comes as "Real Name : Master-CMxxxxxx"
// Strip the suffix → always gives a real group name, never a tier
// Class 4 is unreliable — often contains the tier name instead of group name
export const extractGroupName = (parentName?: any, class4?: any, fallbackChildName?: any): string => {
  const fromParent = ((parentName as string) || "").replace(/\s*:\s*Master-CM\d+$/i, "").trim();
  const BAD = new Set(["STANDARD","HOUSE ACCOUNTS","SILVER","GOLD","PLATINUM","DIAMOND",
                       "TOP 100","GRAND TOTAL","TOTAL",""]);
  if (fromParent && !BAD.has(fromParent.toUpperCase())) return fromParent;
  const c4 = ((class4 as string) || "").trim();
  if (c4 && !BAD.has(c4.toUpperCase())) return c4;
  return (fallbackChildName as string) || "";
};
