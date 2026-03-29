"use client";
// @ts-nocheck
import { useState } from "react";
import { T } from "@/lib/tokens";
import {
  NOTICE_SEVERITY_COLOR, NOTICE_SEVERITY_BG, NOTICE_TYPE_ICON,
} from "@/lib/notices";

// ── Individual notice card ────────────────────────────────────────
function NoticeCard({ notice, onDismiss, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const sc = NOTICE_SEVERITY_COLOR[notice.severity];
  const sb = NOTICE_SEVERITY_BG[notice.severity];
  const icon = NOTICE_TYPE_ICON[notice.type];

  return (
    <div style={{
      background: sb,
      border: `1px solid ${sc}28`,
      borderLeft: `3px solid ${sc}`,
      borderRadius: 10,
      marginBottom: 6,
      overflow: "hidden",
    }}>
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", textAlign: "left", background: "none", border: "none",
          cursor: "pointer", fontFamily: "inherit",
          padding: "9px 12px",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <span style={{
              fontSize: 8, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: ".5px", color: sc,
              background: `${sc}18`, borderRadius: 3, padding: "1px 5px",
            }}>
              {notice.severity}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {notice.title}
            </span>
          </div>
          <div style={{ fontSize: 10, color: T.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {notice.groupName}
          </div>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.t4} strokeWidth="2.5"
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 12px 10px", borderTop: `1px solid ${sc}15` }}>
          <div style={{ fontSize: 11, color: T.t2, margin: "8px 0 4px", lineHeight: 1.5 }}>
            {notice.whyItMatters}
          </div>
          <div style={{
            fontSize: 10, color: T.cyan, background: "rgba(34,211,238,.07)",
            borderRadius: 6, padding: "5px 8px", marginBottom: 8, lineHeight: 1.4,
          }}>
            → {notice.suggestedAction}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => onOpen(notice.groupId)}
              style={{
                flex: 1, padding: "5px 0", borderRadius: 7, fontSize: 10, fontWeight: 700,
                background: `${sc}15`, border: `1px solid ${sc}30`, color: sc,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Open Account →
            </button>
            <button
              onClick={() => onDismiss(notice.id)}
              style={{
                padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 600,
                background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)",
                color: T.t4, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Notices panel ─────────────────────────────────────────────────
export default function NoticesPanel({ notices, onDismiss, onOpen }) {
  const [collapsed, setCollapsed] = useState(false);

  if (notices.length === 0) return null;

  const highCount = notices.filter(n => n.severity === "high").length;

  return (
    <div style={{ padding: "12px 16px 4px" }}>
      {/* Section header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          padding: "0 0 8px",
        }}
      >
        <span style={{ fontSize: 12 }}>🔔</span>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "1px", color: highCount > 0 ? "#f87171" : "#fbbf24",
        }}>
          Notices
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: "#0a0a0f",
          background: highCount > 0 ? "#f87171" : "#fbbf24",
          borderRadius: 8, padding: "1px 6px", marginLeft: 2,
        }}>
          {notices.length}
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.t4} strokeWidth="2.5"
          style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .15s", marginLeft: "auto" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {!collapsed && (
        <div>
          {notices.map(n => (
            <NoticeCard
              key={n.id}
              notice={n}
              onDismiss={onDismiss}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}
