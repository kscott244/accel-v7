// @ts-nocheck
"use client";
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$, $f } from "@/lib/format";
import {
  buildResearchQueue,
  mergeResearchFindings,
  RESEARCH_PRIORITY_COLOR,
  RESEARCH_PRIORITY_BG,
  CONFIDENCE_COLOR,
  CONFIDENCE_BG,
  OPP_TYPE_LABEL,
  OPP_TYPE_ICON,
} from "@/lib/researchQueue";

// Props: groups, overlays, patchOverlay, goGroup, activeQ

function ResearchTab({ groups, overlays, patchOverlay, goGroup, activeQ }) {
  const [expandedId, setExpandedId] = useState(null);
  const [researchingId, setResearchingId] = useState(null);
  const [researchError, setResearchError] = useState(null);
  const [viewMode, setViewMode] = useState("queue"); // "queue" | "completed"

  // ── Build candidate queue ──────────────────────────────────────────
  const queue = useMemo(() =>
    buildResearchQueue(groups, overlays, [], { qk: activeQ, maxItems: 6 }),
    [groups, overlays, activeQ]
  );

  // ── Completed research from overlays ───────────────────────────────
  const completedResearch = useMemo(() =>
    ((overlays && overlays.researchQueue) || [])
      .filter(r => r.status === "completed")
      .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")),
    [overlays]
  );

  // ── Trigger research for a candidate ───────────────────────────────
  const runResearch = async (candidate) => {
    setResearchingId(candidate.id);
    setResearchError(null);
    try {
      const group = (groups || []).find(g => g.id === candidate.groupId);
      if (!group) throw new Error("Group not found");

      const children = group.children || [];
      const childNames = children.map(c => c.name).filter(Boolean).slice(0, 6);
      const addresses = children.map(c => [c.addr, c.city, c.st].filter(Boolean).join(", ")).filter(Boolean).slice(0, 4);
      const products = [];
      for (const c of children) {
        for (const p of (c.products || [])) {
          if ((p.cy1 || 0) > 0 && !products.includes(p.n)) products.push(p.n);
        }
      }

      const res = await fetch("/api/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidate.groupName,
          childNames,
          city: children[0]?.city || "",
          state: children[0]?.st || "",
          address: children[0]?.addr || "",
          addresses,
          dealer: children[0]?.dealer || "",
          products: products.slice(0, 5),
          doctor: null,
          gName: candidate.groupName,
          acctId: candidate.groupId,
          ownership: group.class2 || "",
          tier: group.tier || "",
          score: 50,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.userMessage || err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const completed = mergeResearchFindings(candidate, data.intel);

      // Save to overlays.researchQueue
      const existing = (overlays && overlays.researchQueue) || [];
      const filtered = existing.filter(r => r.id !== completed.id);
      const updated = [...filtered, completed];

      if (patchOverlay) {
        patchOverlay([{ op: "set", path: "researchQueue", value: updated }]);
      }

      // Also save enriched contacts to groupContacts overlay
      if (completed.contactsFound && completed.contactsFound.length > 0 && patchOverlay) {
        const existingContacts = (overlays && overlays.groupContacts && overlays.groupContacts[candidate.groupId]) || [];
        const newContacts = completed.contactsFound
          .filter(c => c.name && !existingContacts.some(ec => ec.name === c.name))
          .map((c, i) => ({
            id: Date.now() + i,
            linkedGroupId: candidate.groupId,
            name: c.name,
            role: c.role || "",
            phone: c.phone || "",
            email: c.email || "",
            notes: `Research queue · ${c.notes || ""}`.trim(),
            source: "research",
            confidence: c.confidence === "high" ? "likely" : "unverified",
            isPrimary: i === 0 && existingContacts.length === 0,
            savedAt: new Date().toISOString(),
          }));

        if (newContacts.length > 0) {
          const merged = [...existingContacts, ...newContacts];
          patchOverlay([{ op: "set", path: `groupContacts.${candidate.groupId}`, value: merged }]);
        }
      }

      setResearchingId(null);
      setExpandedId(completed.id);
      setViewMode("completed");
    } catch (err) {
      setResearchError(err.message || "Research failed");
      setResearchingId(null);
    }
  };

  // ── Dismiss a candidate (skip it) ──────────────────────────────────
  const dismissCandidate = (candidate) => {
    const existing = (overlays && overlays.researchQueue) || [];
    const dismissed = { ...candidate, status: "dismissed", completedAt: new Date().toISOString() };
    const filtered = existing.filter(r => r.id !== candidate.id);
    if (patchOverlay) {
      patchOverlay([{ op: "set", path: "researchQueue", value: [...filtered, dismissed] }]);
    }
  };

  // ── Clear completed research ───────────────────────────────────────
  const clearCompleted = () => {
    if (patchOverlay) {
      patchOverlay([{ op: "set", path: "researchQueue", value: [] }]);
    }
  };

  const items = viewMode === "queue" ? queue : completedResearch;

  return (
    <div style={{ padding: "12px 0 80px" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, marginBottom: 2 }}>Research Queue</div>
        <div style={{ fontSize: 10, color: T.t3 }}>
          Targeted research on high-value accounts with weak contact paths
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[
          { key: "queue", label: `Queue (${queue.length})` },
          { key: "completed", label: `Completed (${completedResearch.length})` },
        ].map(m => (
          <button key={m.key} onClick={() => setViewMode(m.key)}
            style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 10, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${viewMode === m.key ? "rgba(79,142,247,.45)" : T.b2}`,
              background: viewMode === m.key ? "rgba(79,142,247,.15)" : T.s2,
              color: viewMode === m.key ? T.blue : T.t3,
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Error banner ── */}
      {researchError && (
        <div style={{
          background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.25)",
          borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: T.red,
        }}>
          {researchError}
          <button onClick={() => setResearchError(null)}
            style={{ background: "none", border: "none", color: T.t4, cursor: "pointer", float: "right", fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* ── Empty state ── */}
      {items.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", color: T.t4, fontSize: 12 }}>
          {viewMode === "queue"
            ? "No accounts currently need research. All high-value accounts have adequate contact paths."
            : "No completed research yet. Run research on queue candidates to build intel."}
        </div>
      )}

      {/* ── Candidate / completed cards ── */}
      {items.map((item, i) => {
        const isExpanded = expandedId === item.id;
        const isResearching = researchingId === item.id;
        const priColor = RESEARCH_PRIORITY_COLOR[item.priority];
        const priBg = RESEARCH_PRIORITY_BG[item.priority];
        const isCompleted = item.status === "completed";

        return (
          <div key={item.id} className="anim" style={{
            animationDelay: `${i * 30}ms`,
            background: T.s2,
            border: `1px solid ${isCompleted ? T.b1 : T.b2}`,
            borderLeft: `3px solid ${isCompleted ? (CONFIDENCE_COLOR[item.confidence] || T.t4) : priColor}`,
            borderRadius: 12, marginBottom: 10,
          }}>
            {/* ── Card header ── */}
            <div onClick={() => setExpandedId(isExpanded ? null : item.id)}
              style={{ display: "flex", alignItems: "flex-start", gap: 10,
                padding: "12px 14px 10px", cursor: "pointer" }}>
              <div style={{ fontSize: 18, lineHeight: 1, paddingTop: 1 }}>
                {OPP_TYPE_ICON[item.opportunityType] || "🔍"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.t1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
                    {item.groupName}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".5px",
                    background: priBg, color: priColor, borderRadius: 4, padding: "2px 6px",
                    textTransform: "uppercase" }}>
                    {item.priority}
                  </span>
                  {isCompleted && item.confidence && (
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".5px",
                      background: CONFIDENCE_BG[item.confidence], color: CONFIDENCE_COLOR[item.confidence],
                      borderRadius: 4, padding: "2px 6px", textTransform: "uppercase" }}>
                      {item.confidence} conf
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: T.t3, marginBottom: 2 }}>
                  {OPP_TYPE_LABEL[item.opportunityType] || item.opportunityType}
                  {" · "}{$$(item.pyRevenue)} PY · {$$(item.cyRevenue)} CY
                  {item.locs > 1 ? ` · ${item.locs} locs` : ""}
                </div>
                <div style={{ fontSize: 11, color: T.t2, lineHeight: 1.4 }}>
                  {isCompleted ? item.findingsSummary : item.reasonForResearch}
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.t4} strokeWidth="2.5"
                style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0, marginTop: 4 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            {/* ── Expanded detail ── */}
            {isExpanded && (
              <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${T.b1}` }}>
                {/* Data points */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, margin: "10px 0" }}>
                  <div style={{ background: T.s1, borderRadius: 6, padding: "6px 8px" }}>
                    <div style={{ fontSize: 8, color: T.t4 }}>Gap</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: item.gapAmount > 0 ? T.red : T.green }}>{$$(item.gapAmount)}</div>
                  </div>
                  <div style={{ background: T.s1, borderRadius: 6, padding: "6px 8px" }}>
                    <div style={{ fontSize: 8, color: T.t4 }}>Contact</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: item.hasPhone ? T.green : item.hasContact ? T.amber : T.red }}>
                      {item.hasPhone ? "📞 Yes" : item.hasContact ? "⚠ Weak" : "✗ None"}
                    </div>
                  </div>
                  <div style={{ background: T.s1, borderRadius: 6, padding: "6px 8px" }}>
                    <div style={{ fontSize: 8, color: T.t4 }}>Last Research</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: item.lastResearchedDays > 30 ? T.amber : T.t2 }}>
                      {item.lastResearchedDays > 300 ? "Never" : `${item.lastResearchedDays}d ago`}
                    </div>
                  </div>
                </div>

                {/* Enriched contacts (completed only) */}
                {isCompleted && item.contactsFound && item.contactsFound.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.t3, marginBottom: 6 }}>
                      Contacts Found
                    </div>
                    {item.contactsFound.map((c, ci) => (
                      <div key={ci} style={{
                        background: T.s1, border: `1px solid ${T.b1}`, borderRadius: 8,
                        padding: "8px 10px", marginBottom: 4,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.t1 }}>{c.name}</span>
                            {c.role && <span style={{ fontSize: 9, color: T.t3 }}> · {c.role}</span>}
                          </div>
                          <span style={{
                            fontSize: 8, fontWeight: 700,
                            background: CONFIDENCE_BG[c.confidence], color: CONFIDENCE_COLOR[c.confidence],
                            borderRadius: 3, padding: "1px 5px", textTransform: "uppercase",
                          }}>{c.confidence}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                          {c.phone && (
                            <a href={`tel:${c.phone.replace(/\D/g, "")}`}
                              style={{ fontSize: 10, color: T.cyan, textDecoration: "none" }}>
                              📞 {c.phone}
                            </a>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`}
                              style={{ fontSize: 10, color: T.blue, textDecoration: "none" }}>
                              ✉ {c.email}
                            </a>
                          )}
                          {c.website && (
                            <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                              target="_blank" rel="noopener"
                              style={{ fontSize: 10, color: T.purple, textDecoration: "none" }}>
                              🌐 Website
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggested linkages (completed only) */}
                {isCompleted && item.suggestedLinkages && item.suggestedLinkages.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.amber, marginBottom: 6 }}>
                      Possible Linked Locations
                    </div>
                    {item.suggestedLinkages.map((link, li) => (
                      <div key={li} style={{
                        background: "rgba(251,191,36,.04)", border: "1px solid rgba(251,191,36,.15)",
                        borderRadius: 8, padding: "8px 10px", marginBottom: 4,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.t1 }}>{link.suggestedGroupName}</div>
                        {link.suggestedAddress && <div style={{ fontSize: 9, color: T.t3 }}>{link.suggestedAddress}</div>}
                        <div style={{ fontSize: 9, color: T.t4, marginTop: 2 }}>{link.reason}</div>
                        <span style={{
                          fontSize: 8, fontWeight: 700, marginTop: 4, display: "inline-block",
                          background: CONFIDENCE_BG[link.confidence], color: CONFIDENCE_COLOR[link.confidence],
                          borderRadius: 3, padding: "1px 5px", textTransform: "uppercase",
                        }}>{link.confidence} confidence</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggested next move (completed only) */}
                {isCompleted && item.suggestedNextMove && (
                  <div style={{
                    background: "rgba(52,211,153,.05)", border: "1px solid rgba(52,211,153,.15)",
                    borderRadius: 8, padding: "8px 10px", marginBottom: 10,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: T.green, marginBottom: 2 }}>Suggested Next Move</div>
                    <div style={{ fontSize: 11, color: T.t1 }}>{item.suggestedNextMove}</div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {!isCompleted && (
                    <>
                      <button onClick={() => runResearch(item)} disabled={isResearching}
                        style={{
                          flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 11, fontWeight: 700,
                          cursor: isResearching ? "wait" : "pointer", fontFamily: "inherit",
                          background: isResearching ? T.s1 : `linear-gradient(90deg,${T.blue},${T.cyan})`,
                          border: "none", color: "#fff",
                        }}>
                        {isResearching ? "Researching…" : "🔍 Research Now"}
                      </button>
                      <button onClick={() => dismissCandidate(item)}
                        style={{
                          padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit",
                          background: T.s1, border: `1px solid ${T.b2}`, color: T.t3,
                        }}>
                        Skip
                      </button>
                    </>
                  )}
                  {/* Go to group */}
                  <button onClick={() => {
                    const g = (groups || []).find(gr => gr.id === item.groupId);
                    if (g && goGroup) goGroup(g);
                  }}
                    style={{
                      padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                      background: T.s1, border: `1px solid ${T.b2}`, color: T.blue,
                    }}>
                    Open →
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Clear completed ── */}
      {viewMode === "completed" && completedResearch.length > 0 && (
        <button onClick={clearCompleted}
          style={{
            width: "100%", padding: "8px 0", borderRadius: 8, fontSize: 10, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", marginTop: 8,
            background: "none", border: `1px solid ${T.b1}`, color: T.t4,
          }}>
          Clear Completed Research
        </button>
      )}
    </div>
  );
}

export default ResearchTab;
