"use client";
// @ts-nocheck
// ─── NEW ADDS SECTION ───────────────────────────────────────────────────────
// Product-first view: accordion by product → accounts that bought it → AcctDetail
// RED = needs follow-up. GREEN = on track.

import { useState } from "react";
import { T } from "@/lib/tokens";
import { Chev, fixGroupName } from "@/components/primitives";
import NEW_ADDS from "@/../../docs/new_adds.json";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const INFECTION_CTRL = new Set([
  "CAVIWIPES","CAVIWIPES 2.0","CAVIWIPES XL","CAVIWIPES HP","CAVIWIPES1",
  "CAVICIDE HP","CAVICIDE",
]);

function productCategory(name: string): "infection" | "restorative" {
  return INFECTION_CTRL.has(name.toUpperCase()) ? "infection" : "restorative";
}

function formatDate(s: string) {
  if (!s) return "";
  const m = s.match(/^(\d+)-(\w+)-(\d+)$/);
  if (!m) return s;
  const months: Record<string,string> = {Jan:"1",Feb:"2",Mar:"3",Apr:"4",May:"5",Jun:"6",
    Jul:"7",Aug:"8",Sep:"9",Oct:"10",Nov:"11",Dec:"12"};
  return `${months[m[2]] || m[2]}/${m[1]}`;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function NewAddsSection({ groups, goAcct, goGroup }) {
  const [openProducts, setOpenProducts] = useState<Record<string, boolean>>({});

  const toggle = (prod: string) =>
    setOpenProducts(prev => ({ ...prev, [prod]: !prev[prod] }));

  // Build child/group lookup
  const childToGroup: Record<string, any> = {};
  const parentToGroup: Record<string, any> = {};
  (groups || []).forEach((g: any) => {
    parentToGroup[g.id] = g;
    (g.children || []).forEach((c: any) => {
      childToGroup[c.id] = { group: g, child: c };
    });
  });

  // Enrich accounts
  const enriched = (NEW_ADDS || []).map((a: any) => {
    const childMatch = childToGroup[a.mdm];
    const parentMatch = !childMatch ? parentToGroup[a.mdm] : null;
    const group = childMatch?.group || parentMatch || null;
    const child = childMatch?.child || null;
    return {
      ...a,
      _group: group,
      _child: child,
      _gId: group?.id,
      _gName: group ? fixGroupName(group) : null,
    };
  });

  // Build product → accounts map
  const prodMap: Record<string, any[]> = {};
  enriched.forEach((a: any) => {
    (a.products || []).forEach((p: string) => {
      if (!prodMap[p]) prodMap[p] = [];
      prodMap[p].push(a);
    });
  });

  // Sort products: restorative first (more clinical value), then by count desc
  const products = Object.keys(prodMap).sort((a, b) => {
    const catA = productCategory(a);
    const catB = productCategory(b);
    if (catA !== catB) return catA === "restorative" ? -1 : 1;
    return prodMap[b].length - prodMap[a].length;
  });

  const totalAccts = new Set(enriched.map((a: any) => a.mdm)).size;
  const totalRed = enriched.filter((a: any) => a.color === "RED").length;

  return (
    <div>
      {/* Summary row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 12, padding: "8px 12px",
        background: "rgba(248,113,113,.06)",
        border: "1px solid rgba(248,113,113,.15)",
        borderRadius: 10,
      }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{totalAccts} new accounts</span>
          <span style={{ fontSize: 10, color: T.t3 }}> · {products.length} products</span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: T.red,
          background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.25)",
          borderRadius: 6, padding: "3px 8px",
        }}>{totalRed} need follow-up</span>
      </div>

      {/* Product accordion */}
      {products.map((prod) => {
        const accts = prodMap[prod];
        const isOpen = !!openProducts[prod];
        const redCount = accts.filter((a: any) => a.color === "RED").length;
        const cat = productCategory(prod);

        return (
          <div key={prod} style={{ marginBottom: 6 }}>
            {/* Product row */}
            <button
              onClick={() => toggle(prod)}
              style={{
                width: "100%", textAlign: "left", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 10,
                background: isOpen ? T.s2 : T.s1,
                border: `1px solid ${isOpen
                  ? (cat === "restorative" ? "rgba(167,139,250,.3)" : "rgba(34,211,238,.2)")
                  : T.b1}`,
                borderLeft: `3px solid ${cat === "restorative" ? T.purple : T.cyan}`,
                borderRadius: isOpen ? "10px 10px 0 0" : 10,
                padding: "10px 12px", cursor: "pointer",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{prod}</div>
                <div style={{ fontSize: 9, color: T.t4, marginTop: 1, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {cat === "restorative" ? "Restorative" : "Infection Control"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {redCount > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: T.red,
                    background: "rgba(248,113,113,.1)",
                    border: "1px solid rgba(248,113,113,.2)",
                    borderRadius: 4, padding: "2px 6px",
                  }}>{redCount} !</span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, color: T.t3 }}>{accts.length}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ color: T.t4, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </button>

            {/* Account list */}
            {isOpen && (
              <div style={{
                background: T.s2,
                border: `1px solid ${T.b1}`,
                borderTop: "none",
                borderRadius: "0 0 10px 10px",
                overflow: "hidden",
              }}>
                {accts
                  .slice()
                  .sort((a: any, b: any) => (a.color === "RED" ? -1 : 1) - (b.color === "RED" ? -1 : 1))
                  .map((a: any, i: number) => {
                    const isRed = a.color === "RED";
                    const isNavigable = !!(a._child || a._group);
                    const isLast = i === accts.length - 1;
                    const handleTap = () => {
                      if (a._child && goAcct) goAcct(a._child);
                      else if (a._group && goGroup) goGroup(a._group);
                    };

                    return (
                      <button
                        key={a.mdm + prod}
                        onClick={isNavigable ? handleTap : undefined}
                        className="anim"
                        style={{
                          animationDelay: `${i * 20}ms`,
                          width: "100%", textAlign: "left", fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 10,
                          background: "transparent",
                          border: "none",
                          borderBottom: isLast ? "none" : `1px solid ${T.b2}`,
                          borderLeft: `3px solid ${isRed ? "rgba(248,113,113,.5)" : "rgba(52,211,153,.4)"}`,
                          padding: "9px 12px",
                          cursor: isNavigable ? "pointer" : "default",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 11, fontWeight: 600, color: T.t1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{a.name}</div>
                          <div style={{ fontSize: 9, color: T.t4, marginTop: 1 }}>
                            {[a.city, a.state].filter(Boolean).join(", ")}
                            {a.last_date ? ` · ${formatDate(a.last_date)}` : ""}
                            {a.products.length > 1
                              ? <span style={{ color: T.blue }}> · +{a.products.length - 1} more products</span>
                              : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{
                            fontSize: 8, fontWeight: 700,
                            color: isRed ? T.red : T.green,
                            background: isRed ? "rgba(248,113,113,.08)" : "rgba(52,211,153,.08)",
                            border: `1px solid ${isRed ? "rgba(248,113,113,.2)" : "rgba(52,211,153,.2)"}`,
                            borderRadius: 4, padding: "2px 5px",
                          }}>{isRed ? "FOLLOW UP" : "ON TRACK"}</span>
                          {isNavigable && <Chev />}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
