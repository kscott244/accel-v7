"use client";
// @ts-nocheck
// ─── REORDER INVOICE ────────────────────────────────────────────────────────
// Reconstructs a reorder from PY product history minus CY already bought.
// Invoice tab: doctor-facing MSRP only. Savings tab: promos + upsell suggestion.
// Ken's WS credit shown as a single line below — never visible on doctor copy.

import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$, $f } from "@/lib/format";
import { normalizeTier } from "@/lib/tier";
import REORDER_DATA from "@/data/reorder_data.json";

const { prices: PRICES, prodToCat: PROD_TO_CAT,
        nationalPromos: NAT_PROMOS, upsellRules: UPSELL_RULES } = REORDER_DATA as any;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const RESTORATIVE_CATS = new Set([
  "SIMPLISHADE","HARMONIZE","HERCULITE ULTRA","HERCULITE ULTRA FLOW","SONICFILL 3",
  "POINT 4","FLOW-IT ALC","PREMISE","SIMILE","OPTIBOND SOLO PLUS","OPTIBOND UNIVERSAL",
  "OPTIBOND EXTRA","OPTIBOND 360","MAXCEM ELITE","MAXCEM ELITE CHROMA","NX3","TEMPBOND",
]);

function getTierKey(tier: string) {
  const t = (tier||"").toLowerCase();
  if (t.includes("diamond")) return "dia";
  if (t.includes("platinum")) return "plat";
  if (t.includes("gold")) return "gold";
  if (t.includes("silver")) return "silv";
  return "std";
}

function getPrice(cat: string, tk: string) {
  const p = PRICES[cat?.toUpperCase()];
  if (!p) return null;
  return { ws: p[`${tk}_ws`] ?? p.std_ws, msrp: p[`${tk}_msrp`] ?? p.std_msrp };
}

function buildLines(acct: any, q: string, tk: string) {
  const qk = q === "FY" ? "1" : q;
  const lines: any[] = [];
  (acct.products || []).forEach((p: any) => {
    const pName = (p.n || "").toUpperCase();
    const cat = PROD_TO_CAT[pName] || PROD_TO_CAT[p.n];
    if (!cat) return;
    const price = getPrice(cat, tk);
    if (!price || price.ws <= 5) return; // skip near-zero priced items
    const pyAmt = p[`py${qk}`] || 0;
    const cyAmt = p[`cy${qk}`] || 0;
    if (pyAmt <= 0) return;
    const pyQty = Math.max(1, Math.round(pyAmt / price.ws));
    const cyQty = Math.round(cyAmt / price.ws);
    const gapQty = pyQty - cyQty;
    if (gapQty <= 0) return;
    lines.push({
      name: p.n, cat, pyQty, cyQty, gapQty,
      unitMsrp: price.msrp, unitWs: price.ws,
      lineMsrp: +(gapQty * price.msrp).toFixed(2),
      lineWs:   +(gapQty * price.ws).toFixed(2),
    });
  });
  lines.sort((a, b) => {
    const sec = (x: any) => RESTORATIVE_CATS.has(x.cat) ? 0 : 1;
    if (sec(a) !== sec(b)) return sec(a) - sec(b);
    return b.lineMsrp - a.lineMsrp;
  });
  return lines;
}

function calcSavings(lines: any[], isStandard: boolean) {
  if (!isStandard) return [];
  const savings: any[] = [];
  NAT_PROMOS.forEach((promo: any) => {
    const qual = lines.filter((l: any) => promo.products.includes(l.cat));
    if (!qual.length) return;
    const totalQty = qual.reduce((s: number, l: any) => s + l.gapQty, 0);
    if (totalQty < promo.buyQty) return;
    const freeUnits = Math.floor(totalQty / promo.buyQty) * promo.freeQty;
    if (!freeUnits) return;
    const cheapest = qual.reduce((a: any, b: any) => a.unitMsrp <= b.unitMsrp ? a : b);
    savings.push({
      label: promo.label,
      products: qual.map((l: any) => l.name).join(" + "),
      freeUnits,
      freeProd: cheapest.name,
      savingsMsrp: +(freeUnits * cheapest.unitMsrp).toFixed(2),
      code: promo.code,
    });
  });
  return savings;
}

function findUpsell(lines: any[], acct: any, q: string) {
  const qk = q === "FY" ? "1" : q;
  const buyingCats = new Set(lines.map((l: any) => l.cat));
  const pyPositive = new Set(
    (acct.products || [])
      .filter((p: any) => (p[`py${qk}`]||0) > 0)
      .map((p: any) => PROD_TO_CAT[(p.n||"").toUpperCase()] || PROD_TO_CAT[p.n])
      .filter(Boolean)
  );
  for (const rule of UPSELL_RULES) {
    const triggered = rule.if_buying.some((c: string) => buyingCats.has(c) || pyPositive.has(c));
    if (!triggered || buyingCats.has(rule.suggest)) continue;
    const promo = rule.promo_id ? NAT_PROMOS.find((p: any) => p.id === rule.promo_id) : null;
    return { cat: rule.suggest, reason: rule.reason, promo };
  }
  return null;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function ReorderInvoice({ acct, activeQ = "1", onClose }: {
  acct: any; activeQ?: string; onClose: () => void;
}) {
  const [tab, setTab] = useState<"invoice"|"savings">("invoice");
  const [q, setQ] = useState(activeQ === "FY" ? "1" : activeQ);
  const [editQtys, setEditQtys] = useState<Record<string,number>>({});

  const tier = normalizeTier(acct.gTier || acct.tier || "Standard");
  const tierKey = getTierKey(tier);
  const isStandard = tierKey === "std";

  const baseLines = useMemo(() => buildLines(acct, q, tierKey), [acct, q, tierKey]);

  const lines = useMemo(() => baseLines.map(l => {
    const eq = editQtys[l.cat];
    if (eq === undefined) return l;
    return { ...l, gapQty: eq,
      lineMsrp: +(eq * l.unitMsrp).toFixed(2),
      lineWs:   +(eq * l.unitWs).toFixed(2) };
  }).filter(l => l.gapQty > 0), [baseLines, editQtys]);

  const savings = useMemo(() => calcSavings(lines, isStandard), [lines, isStandard]);
  const upsell  = useMemo(() => findUpsell(lines, acct, q), [lines, acct, q]);

  const subtotalMsrp = lines.reduce((s, l) => s + l.lineMsrp, 0);
  const totalSavings = savings.reduce((s, p) => s + p.savingsMsrp, 0);
  const totalMsrp    = subtotalMsrp - totalSavings;
  const totalWs      = lines.reduce((s, l) => s + l.lineWs, 0);

  const tabBtn = (k: "invoice"|"savings", label: string, badge?: number) => (
    <button onClick={() => setTab(k)} style={{
      flex: 1, padding: "7px 0", borderRadius: 8, border: "none", fontFamily: "inherit",
      background: tab === k ? "rgba(79,142,247,.2)" : "transparent",
      color: tab === k ? T.blue : T.t3, fontSize: 11, fontWeight: 700, cursor: "pointer",
      position: "relative",
    }}>
      {label}
      {!!badge && <span style={{
        position: "absolute", top: 2, right: 8,
        fontSize: 8, fontWeight: 800, color: T.green,
        background: "rgba(52,211,153,.15)", borderRadius: 99, padding: "1px 4px",
      }}>{badge}</span>}
    </button>
  );

  if (lines.length === 0) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.75)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", background: T.s1, borderRadius: "20px 20px 0 0", padding: 20 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Build Reorder</div>
        <div style={{ fontSize: 12, color: T.t4, textAlign: "center", padding: "20px 0" }}>
          No Q{q} product gap found — this account is fully caught up or has no prior year data.
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "10px 0", borderRadius: 10,
          border: `1px solid ${T.b1}`, background: "transparent", color: T.t3,
          fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.75)",
      backdropFilter: "blur(8px)", display: "flex", flexDirection: "column",
      justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ background: T.s1, borderRadius: "20px 20px 0 0", padding: "16px 16px 0",
        maxHeight: "88vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>Reorder — {acct.name}</div>
            <div style={{ fontSize: 10, color: T.t4, marginTop: 2 }}>
              {tier} · Q{q} gap · {lines.length} products
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none",
            color: T.t4, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 2px" }}>✕</button>
        </div>

        {/* Quarter selector */}
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {["1","2","3","4"].map(qr => (
            <button key={qr} onClick={() => { setQ(qr); setEditQtys({}); }} style={{
              flex: 1, padding: "5px 0", borderRadius: 7, fontSize: 10, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${q===qr ? "rgba(79,142,247,.35)" : T.b2}`,
              background: q===qr ? "rgba(79,142,247,.15)" : T.s2,
              color: q===qr ? T.blue : T.t3,
            }}>Q{qr}</button>
          ))}
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", gap: 3, background: T.s2, borderRadius: 10,
          padding: 3, marginBottom: 12 }}>
          {tabBtn("invoice", "📋 Invoice")}
          {tabBtn("savings", `💰 Savings`, savings.length || undefined)}
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: 8 }}>

          {/* ── INVOICE TAB ── */}
          {tab === "invoice" && <>
            {/* Line items */}
            <div style={{ background: T.s2, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 72px 72px",
                gap: 4, padding: "7px 12px",
                borderBottom: `1px solid ${T.b2}` }}>
                {["Product","Qty","Unit","Total"].map(h => (
                  <div key={h} style={{ fontSize: 9, color: T.t4, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: ".5px",
                    textAlign: h === "Product" ? "left" : "right" }}>{h}</div>
                ))}
              </div>
              {lines.map((l, i) => (
                <div key={l.cat} style={{
                  display: "grid", gridTemplateColumns: "1fr 52px 72px 72px",
                  gap: 4, padding: "9px 12px",
                  borderBottom: i < lines.length-1 ? `1px solid ${T.b2}` : "none",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,.015)",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.t1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.name}
                    </div>
                    <div style={{ fontSize: 9, color: T.t4, marginTop: 1 }}>
                      {RESTORATIVE_CATS.has(l.cat) ? "Restorative" : "TotalCare"}
                      {l.cyQty > 0 ? ` · ${l.cyQty} already this Q` : ""}
                    </div>
                  </div>
                  {/* Editable qty */}
                  <div style={{ textAlign: "right" }}>
                    <input
                      type="number" min={0} value={editQtys[l.cat] ?? l.gapQty}
                      onChange={e => {
                        const v = parseInt(e.target.value);
                        setEditQtys(prev => ({ ...prev, [l.cat]: isNaN(v) ? 0 : Math.max(0, v) }));
                      }}
                      style={{ width: 44, textAlign: "right", background: T.s1,
                        border: `1px solid ${T.b1}`, borderRadius: 5,
                        color: T.t1, fontSize: 11, padding: "2px 4px",
                        fontFamily: "inherit", outline: "none" }}
                    />
                  </div>
                  <div style={{ textAlign: "right", fontSize: 11, color: T.t2,
                    fontFamily: "monospace", paddingTop: 3 }}>
                    ${l.unitMsrp.toFixed(2)}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 11, fontWeight: 700,
                    color: T.t1, fontFamily: "monospace", paddingTop: 3 }}>
                    ${l.lineMsrp.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ background: T.s2, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
              {savings.length > 0 && <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: T.t3 }}>Subtotal</span>
                  <span style={{ fontSize: 11, color: T.t2, fontFamily: "monospace" }}>
                    ${subtotalMsrp.toFixed(2)}
                  </span>
                </div>
                {savings.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between",
                    marginBottom: 5, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <span style={{ fontSize: 10, color: T.green }}>
                        🎁 {s.label} ({s.freeUnits} {s.freeProd} free)
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.green,
                      fontFamily: "monospace", flexShrink: 0 }}>
                      −${s.savingsMsrp.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div style={{ height: 1, background: T.b2, margin: "8px 0" }}/>
              </>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>Total</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: T.t1, fontFamily: "monospace" }}>
                  ${totalMsrp.toFixed(2)}
                </span>
              </div>
              {totalSavings > 0 && (
                <div style={{ fontSize: 10, color: T.green, textAlign: "right", marginTop: 3 }}>
                  You save ${totalSavings.toFixed(2)} with promos
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div style={{ fontSize: 9, color: T.t4, textAlign: "center",
              padding: "0 8px 4px", lineHeight: 1.5 }}>
              * Pricing based on retail MSRP. Contact your distributor for actual pricing —
              dealer discounts typically apply.
            </div>
          </>}

          {/* ── SAVINGS TAB ── */}
          {tab === "savings" && <>
            {savings.length === 0 && !upsell && (
              <div style={{ fontSize: 12, color: T.t4, textAlign: "center", padding: "30px 0" }}>
                {isStandard
                  ? "No promos apply to this order at current quantities."
                  : "National promos apply to Standard/Private Practice accounts only."}
              </div>
            )}

            {/* Applied promos */}
            {savings.map((s, i) => (
              <div key={i} style={{ background: "rgba(52,211,153,.06)",
                border: "1px solid rgba(52,211,153,.2)", borderRadius: 12,
                padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.green }}>
                      🎁 {s.label}
                    </div>
                    <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>
                      {s.products} · {s.freeUnits}× {s.freeProd} free
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.green,
                      fontFamily: "monospace" }}>−${s.savingsMsrp.toFixed(2)}</div>
                    <div style={{ fontSize: 9, color: T.t4, marginTop: 2 }}>Code: {s.code}</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Total savings summary */}
            {savings.length > 0 && (
              <div style={{ background: T.s2, borderRadius: 12, padding: "12px 14px",
                marginBottom: 12, display: "flex", justifyContent: "space-between",
                alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>
                  Total Doctor Savings
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: T.green,
                  fontFamily: "monospace" }}>${totalSavings.toFixed(2)}</span>
              </div>
            )}

            {/* Upsell suggestion */}
            {upsell && (
              <div style={{ background: "rgba(79,142,247,.06)",
                border: "1px solid rgba(79,142,247,.2)", borderRadius: 12,
                padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.blue,
                  textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>
                  💡 Suggested Add-On
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.t1, marginBottom: 3 }}>
                  {upsell.cat}
                </div>
                <div style={{ fontSize: 11, color: T.t3, marginBottom: upsell.promo ? 6 : 0 }}>
                  {upsell.reason}
                </div>
                {upsell.promo && (
                  <div style={{ fontSize: 10, color: T.green, marginTop: 4 }}>
                    🎁 {upsell.promo.label} applies if they order {upsell.promo.buyQty}+
                  </div>
                )}
              </div>
            )}

            {/* Promo disclaimer */}
            {isStandard && (
              <div style={{ fontSize: 9, color: T.t4, textAlign: "center",
                padding: "4px 8px", lineHeight: 1.5 }}>
                Promos valid Jan 1 – Mar 31, 2026. Code NPWS26. Limit 3 redemptions per location.
                Submit invoice to kerrpromo@kerrdental.com.
              </div>
            )}
            {!isStandard && (
              <div style={{ fontSize: 9, color: T.t4, textAlign: "center",
                padding: "4px 8px", lineHeight: 1.5 }}>
                This account is on the Accelerate program — national free goods promos do not apply.
              </div>
            )}
          </>}
        </div>

        {/* Ken's WS credit — never on doctor copy */}
        <div style={{ borderTop: `1px solid ${T.b2}`, padding: "10px 0 4px",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: T.t4 }}>Your WS credit on this order</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.amber,
            fontFamily: "monospace" }}>${totalWs.toFixed(2)}</span>
        </div>

        {/* Bottom padding for safe area */}
        <div style={{ height: 16 }}/>
      </div>
    </div>
  );
}
