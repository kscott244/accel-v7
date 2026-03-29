"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
import { fixGroupName } from "@/components/primitives";
import { logEvent } from "@/lib/eventLog";
import { memoryPatchOp } from "@/lib/accountMemory";
import {
  buildDsoCard, sortCards, shouldInclude,
  BENCH_AVG, BENCH_TOP, WR_THRESHOLDS,
  STATUS_OPTS, STRATEGY_OPTS,
  DSO_FAMILIES,
  type BenchMode, type SortMode, type DsoCard, type DsoIntel, type IncludeReason,
} from "@/lib/dsoWarRoom";

// ── Helpers ───────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1000000) return `$${(n/1000000).toFixed(1)}M`;
  if (n >= 1000)    return `$${Math.round(n/1000)}K`;
  return `$${Math.round(n)}`;
}
function fmtFull(n: number): string { return $$(n); }

const CONF_COL: Record<string,string> = { Observed: T.green, Partial: T.amber, Estimated: T.t4 };
const REASON_COL: Record<string,string> = {
  DSO: T.t4, "Multi-site": T.cyan, "Large gap": T.orange, Strategic: T.purple, Pinned: T.amber
};
const STATUS_COL: Record<string,string> = {
  "No Contact": T.t4, "In Progress": T.blue,
  "Meeting Set": T.amber, "Active Push": T.green,
};
const SORT_LABELS: Record<string,string> = {
  gap: "Largest Gap", perOffice: "Lowest $/Office",
  momentum: "Momentum", pinned: "Pinned First",
};

// ── Intel edit drawer ─────────────────────────────────────────────
function IntelDrawer({ groupId, groupName, intel, onSave, onClose }: any) {
  const [v, setV] = useState<DsoIntel>({ ...intel });
  const field = (key: string, label: string, type = "text") => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.t4, marginBottom: 4 }}>{label}</div>
      <input type={type} value={(v as any)[key] || ""} onChange={(e: any) => setV({ ...v, [key]: e.target.value })}
        style={{ width: "100%", background: T.s2, border: `1px solid ${T.b1}`, borderRadius: 8,
          padding: "8px 10px", fontSize: 12, color: T.t1, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
  const pills = (key: string, label: string, opts: readonly string[], colFn?: (o: string) => string) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.t4, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {opts.map(o => {
          const active = (v as any)[key] === o;
          const col = colFn ? colFn(o) : T.blue;
          return <button key={o} onClick={() => setV({ ...v, [key]: active ? undefined : o })}
            style={{ padding: "4px 10px", borderRadius: 7, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: active ? `${col}20` : T.s2, border: `1px solid ${active ? col + "44" : T.b2}`, color: active ? col : T.t3 }}>{o}</button>;
        })}
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,.7)", display: "flex",
      alignItems: "flex-end" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "100%", maxWidth: 960, margin: "0 auto", background: T.bg,
        borderRadius: "18px 18px 0 0", padding: "16px 16px 40px", maxHeight: "85vh", overflowY: "auto",
        borderTop: `1px solid ${T.b1}` }} onClick={(e: any) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>Intel — {groupName}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.t4, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {field("procurementContact", "Procurement Contact")}
        {field("procurementPhone", "Contact Phone", "tel")}
        {field("competitor", "Main Competitor")}
        {field("owner", "Relationship Owner")}
        {field("lastContact", "Last Contact Date", "date")}
        {pills("status", "Status", STATUS_OPTS, (o) => STATUS_COL[o] || T.blue)}
        {pills("accelTier", "Accelerate Pricing Tier", ["Private","Silver","Gold","Platinum","Diamond"],
          (o:string) => o==="Private"?T.t3:o==="Silver"?T.cyan:o==="Gold"?T.amber:o==="Platinum"?T.purple:T.blue)}
        {pills("strategy", "Strategy", STRATEGY_OPTS)}

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.t4, marginBottom: 4 }}>Est. Team Opportunity ($/quarter)</div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.t4, fontSize: 13 }}>$</span>
            <input type="number" value={v.teamOppQ || ""} onChange={(e: any) => setV({ ...v, teamOppQ: parseFloat(e.target.value) || null })}
              placeholder="Manual estimate — your bag + Stu's"
              style={{ width: "100%", background: T.s2, border: `1px solid ${T.b1}`, borderRadius: 8,
                padding: "8px 10px 8px 22px", fontSize: 12, color: T.t1, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ fontSize: 9, color: T.t4, marginTop: 3 }}>Your data only. Enter combined estimate manually.</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.t4, marginBottom: 4 }}>Notes</div>
          <textarea value={v.notes || ""} onChange={(e: any) => setV({ ...v, notes: e.target.value })}
            rows={3} placeholder="Political situation, blockers, key contacts..."
            style={{ width: "100%", background: T.s2, border: `1px solid ${T.b1}`, borderRadius: 8,
              padding: "8px 10px", fontSize: 12, color: T.t1, fontFamily: "inherit", outline: "none",
              resize: "none", boxSizing: "border-box" }} />
        </div>

        <button onClick={() => { onSave(groupId, v); onClose(); }}
          style={{ width: "100%", padding: "12px", borderRadius: 12, background: T.blue, border: "none",
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Save Intel
        </button>
      </div>
    </div>
  );
}

// ── DSO Card ──────────────────────────────────────────────────────
function DsoCardView({ card, intel, benchMode, onPin, onIntel, onTask, onOpen }: any) {
  const { group, locs, cy1, py1, perOffice, benchQ, benchGapQ, benchGapAnn, momentum, coverage, confidence, statement } = card;
  const name     = fixGroupName(group);
  const pinned   = intel?.pinned;
  const accelTier = intel?.accelTier || "Private";
  const ACCEL_CREDIT: Record<string,number> = { Private:0.601,Silver:0.508,Gold:0.476,Platinum:0.437,Diamond:0.403 };
  const creditRate = ACCEL_CREDIT[accelTier] || 0.601;
  const repCreditAnn = Math.round(benchGapAnn * (creditRate / 0.601));
  const status   = intel?.status;
  const strategy = intel?.strategy;
  const confCol  = CONF_COL[confidence] || T.t4;
  const benchPO  = benchMode === "avg" ? BENCH_AVG : BENCH_TOP;
  const moreGap  = benchGapQ > 0;

  return (
    <div className="anim" style={{ background: T.s1, border: `1px solid ${pinned ? T.amber + "44" : T.b1}`,
      borderLeft: `3px solid ${pinned ? T.amber : moreGap ? T.red : T.green}`,
      borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.t1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ display: "flex", gap: 5, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
            {/* Accelerate Tier from intel only — Tableau tier field is not Accelerate pricing */}
            {intel?.accelTier && intel.accelTier !== "Private" && (
              <span style={{ fontSize: 8, fontWeight: 700, color: T.amber, background: `${T.amber}18`,
                borderRadius: 4, padding: "1px 6px", border: `1px solid ${T.amber}30` }}>{intel.accelTier}</span>
            )}
            {/* Class2 */}
            <span style={{ fontSize: 8, color: T.t4, background: T.s2, borderRadius: 4, padding: "1px 6px" }}>
              {group.class2 || "DSO"}
            </span>
            {/* Confidence */}
            <span style={{ fontSize: 8, fontWeight: 700, color: confCol, background: `${confCol}15`,
              borderRadius: 4, padding: "1px 6px", border: `1px solid ${confCol}25` }}>{confidence}</span>
            {/* Status */}
            {status && (
              <span style={{ fontSize: 8, fontWeight: 700, color: STATUS_COL[status] || T.t4,
                background: `${STATUS_COL[status] || T.t4}15`, borderRadius: 4, padding: "1px 6px" }}>{status}</span>
            )}
            {/* Inclusion reason — only show for non-DSO accounts */}
            {(card as any).includeReason && (card as any).includeReason !== "DSO" && (card as any).includeReason !== "Pinned" && (()=>{
              const r = (card as any).includeReason as string;
              const col = REASON_COL[r] || T.t4;
              return <span style={{ fontSize: 8, fontWeight: 700, color: col,
                background: `${col}15`, borderRadius: 4, padding: "1px 6px",
                border: `1px solid ${col}25` }}>{r}</span>;
            })()}
          </div>
        </div>
        {/* Pin + actions */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
          <button onClick={onPin} style={{ background: pinned ? `${T.amber}20` : T.s2,
            border: `1px solid ${pinned ? T.amber + "44" : T.b2}`, borderRadius: 7,
            padding: "4px 7px", fontSize: 13, cursor: "pointer" }} title={pinned ? "Unpin" : "Pin"}>
            {pinned ? "★" : "☆"}
          </button>
        </div>
      </div>

      {/* Core metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
        <div style={{ background: T.s2, borderRadius: 8, padding: "6px 8px" }}>
          <div style={{ fontSize: 8, color: T.t4, marginBottom: 2 }}>Offices</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.t1 }}>{locs}</div>
        </div>
        <div style={{ background: T.s2, borderRadius: 8, padding: "6px 8px" }}>
          <div style={{ fontSize: 8, color: T.t4, marginBottom: 2 }}>$/Office</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: perOffice >= benchPO ? T.green : T.red }}>
            {fmt(perOffice)}
          </div>
          <div style={{ fontSize: 7, color: T.t4 }}>vs {fmt(benchPO)}</div>
        </div>
        <div style={{ background: T.s2, borderRadius: 8, padding: "6px 8px" }}>
          <div style={{ fontSize: 8, color: T.t4, marginBottom: 2 }}>CY Q1</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{fmt(cy1)}</div>
        </div>
      </div>

      {/* Benchmark gap */}
      {moreGap && (
        <div style={{ background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.15)",
          borderRadius: 9, padding: "8px 10px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, color: T.t4, marginBottom: 1 }}>Quarterly gap to benchmark</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.red }}>{fmt(benchGapQ)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: T.t4, marginBottom: 1 }}>Annualized upside</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.amber }}>{fmt(benchGapAnn)}</div>
            </div>
          </div>
          {accelTier !== "Private" && benchGapAnn > 0 && (
            <div style={{ borderTop: `1px solid rgba(248,113,113,.2)`, paddingTop: 6, marginTop: 4,
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: T.t4 }}>
                Rep credit at {accelTier} ({(creditRate*100).toFixed(0)}% vs 60%)
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.orange }}>{fmt(repCreditAnn)}</div>
            </div>
          )}
        </div>
      )}

      {/* Product family coverage */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {DSO_FAMILIES.map(f => {
            const present = coverage.present.includes(f);
            return <span key={f} style={{
              fontSize: 8, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
              background: present ? `${T.green}15` : `${T.red}10`,
              border: `1px solid ${present ? T.green + "30" : T.red + "20"}`,
              color: present ? T.green : T.red,
            }}>{f.replace(" CONTROL", "").replace("TEMP ", "TEMP")}</span>;
          })}
        </div>
        <div style={{ fontSize: 8, color: T.t4, marginTop: 3 }}>
          {coverage.present.length}/5 families · {coverage.missing.length > 0 ? `Missing: ${coverage.missing.map(f => f.split(" ")[0]).join(", ")}` : "Full coverage"}
        </div>
      </div>

      {/* Opportunity statement */}
      <div style={{ fontSize: 10, color: T.t3, background: T.s2, borderRadius: 8, padding: "7px 9px",
        marginBottom: 8, lineHeight: 1.5 }}>{statement}</div>

      {/* Intel preview */}
      {(intel?.procurementContact || intel?.competitor || intel?.owner || intel?.notes) && (
        <div style={{ borderTop: `1px solid ${T.b2}`, paddingTop: 7, marginBottom: 8 }}>
          {intel.procurementContact && (
            <div style={{ fontSize: 10, color: T.cyan, marginBottom: 2 }}>
              👤 {intel.procurementContact}{intel.procurementPhone ? ` · ${intel.procurementPhone}` : ""}
            </div>
          )}
          {intel.competitor && (
            <div style={{ fontSize: 10, color: T.red, marginBottom: 2 }}>⚔ {intel.competitor}</div>
          )}
          {intel.owner && (
            <div style={{ fontSize: 10, color: T.t3, marginBottom: 2 }}>Owner: {intel.owner}</div>
          )}
          {strategy && (
            <div style={{ fontSize: 9, color: T.purple, marginBottom: 2 }}>🎯 {strategy}</div>
          )}
          {intel.teamOppQ && (
            <div style={{ fontSize: 9, color: T.amber }}>
              Est. team opp: {fmt(intel.teamOppQ)}/Q <span style={{ color: T.t4 }}>(manual)</span>
            </div>
          )}
          {intel.notes && (
            <div style={{ fontSize: 10, color: T.t3, fontStyle: "italic", marginTop: 3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{intel.notes}"</div>
          )}
        </div>
      )}

      {/* Action row */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onIntel} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 10,
          fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.25)", color: T.purple }}>
          ✏ Intel
        </button>
        <button onClick={onTask} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 10,
          fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          background: "rgba(79,142,247,.1)", border: "1px solid rgba(79,142,247,.25)", color: T.blue }}>
          + Task
        </button>
        <button onClick={onOpen} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 10,
          fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          background: T.s2, border: `1px solid ${T.b1}`, color: T.t3 }}>
          Open →
        </button>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────
export default function DsoWarRoomTab({ groups, overlays, patchOverlay, goGroup, onAddTask }: any) {
  const [benchMode, setBenchMode] = useState<BenchMode>("avg");
  const [sortMode,  setSortMode]  = useState<SortMode>("gap");
  const [editId,    setEditId]    = useState<string | null>(null);

  // Local intel mirror for fast UI — patchOverlay writes to durable store
  const intel: Record<string, DsoIntel> = overlays?.dsoIntel || {};

  const saveIntel = async (groupId: string, data: DsoIntel) => {
    const card = cards.find(c => c.group.id === groupId);
    logEvent("intel:updated", { groupId, groupName: card ? fixGroupName(card.group) : groupId });
    if (patchOverlay) {
      await patchOverlay([
        { op: "set", path: `dsoIntel.${groupId}`, value: data },
        memoryPatchOp(groupId, { lastActionAt: new Date().toISOString(), lastMeaningfulChangeAt: new Date().toISOString() }),
      ]);
    }
  };

  const togglePin = async (groupId: string) => {
    const cur = intel[groupId] || {};
    const card = cards.find(c => c.group.id === groupId);
    logEvent("pin:toggled", { groupId, groupName: card ? fixGroupName(card.group) : groupId });
    if (patchOverlay) patchOverlay([memoryPatchOp(groupId, { lastActionAt: new Date().toISOString() })]);
    await saveIntel(groupId, { ...cur, pinned: !cur.pinned });
  };

  // Build cards from DSO + Emerging DSO groups
  const cards = useMemo(() => {
    const built: DsoCard[] = [];
    for (const g of (groups || [])) {
      const card = buildDsoCard(g, benchMode);
      const reason = shouldInclude(g, card, intel);
      if (!reason) continue;
      (card as any).includeReason = reason;
      built.push(card);
    }
    return sortCards(built, sortMode, intel);
  }, [groups, benchMode, sortMode, overlays]);

  // Summary stats
  const totalGapQ   = cards.reduce((s, c) => s + c.benchGapQ, 0);
  const totalGapAnn = cards.reduce((s, c) => s + c.benchGapAnn, 0);
  const totalOffices = cards.reduce((s, c) => s + c.locs, 0);

  const editCard = cards.find(c => c.group.id === editId);

  return (
    <div style={{ padding: "0 0 80px" }}>

      {/* Header */}
      <div style={{ padding: "12px 16px 10px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>Strategic Accounts War Room</div>
        <div style={{ fontSize: 10, color: T.t4, marginTop: 1 }}>
          {cards.length} groups · {totalOffices} offices · {$$(totalGapQ)} quarterly gap · {$$(totalGapAnn)} annual upside
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: "0 16px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Benchmark toggle */}
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
            color: T.t4, alignSelf: "center", marginRight: 4 }}>Benchmark</div>
          {(["avg","top"] as BenchMode[]).map(m => (
            <button key={m} onClick={() => setBenchMode(m)} style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 10, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              background: benchMode === m ? `${T.blue}20` : T.s1,
              border: `1px solid ${benchMode === m ? T.blue + "44" : T.b2}`,
              color: benchMode === m ? T.blue : T.t3,
            }}>{m === "avg" ? `Avg $${BENCH_AVG}` : `Top $${BENCH_TOP}`}</button>
          ))}
        </div>
        {/* Sort */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
            color: T.t4, alignSelf: "center", marginRight: 4 }}>Sort</div>
          {(["gap","perOffice","momentum","pinned"] as SortMode[]).map(m => (
            <button key={m} onClick={() => setSortMode(m)} style={{
              padding: "4px 10px", borderRadius: 7, fontSize: 9, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: sortMode === m ? `${T.purple}20` : T.s1,
              border: `1px solid ${sortMode === m ? T.purple + "44" : T.b2}`,
              color: sortMode === m ? T.purple : T.t3,
            }}>{SORT_LABELS[m]}</button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: "0 16px" }}>
        {cards.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: T.t4, fontSize: 12 }}>
            No DSO or Emerging DSO groups found in current data.
          </div>
        )}
        {cards.map(card => (
          <DsoCardView
            key={card.group.id}
            card={card}
            intel={intel[card.group.id] || {}}
            benchMode={benchMode}
            onPin={() => togglePin(card.group.id)}
            onIntel={() => setEditId(card.group.id)}
            onTask={() => onAddTask && onAddTask({
              action: `📋 DSO: ${fixGroupName(card.group)}`,
              dueDate: new Date(Date.now() + 7*86400000).toISOString().slice(0,10),
              priority: "High",
              notes: card.statement,
            }, null, card.group)}
            onOpen={() => goGroup && goGroup(card.group)}
          />
        ))}
      </div>

      {/* Intel drawer */}
      {editId && (
        <IntelDrawer
          groupId={editId}
          groupName={editId ? fixGroupName(cards.find(c => c.group.id === editId)?.group || { name: editId }) : editId}
          intel={intel[editId] || {}}
          onSave={saveIntel}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  );
}

