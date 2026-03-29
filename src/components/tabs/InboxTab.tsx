"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import {
  buildInboxItems,
  INBOX_PRIORITY_COLOR,
  INBOX_PRIORITY_BG,
  INBOX_ACTION_ICON,
  INBOX_ACTION_LABEL,
  type InboxItem,
  type InboxStatus,
} from "@/lib/assistantInbox";

// ── Props ─────────────────────────────────────────────────────────
interface InboxTabProps {
  groups: any[];
  overlays: any;
  patchOverlay: (ops: any[]) => Promise<boolean>;
  tasks: any[];
  goGroup: (id: string) => void;
  onAddTask: (data: any, acct?: any, grp?: any) => void;
  activeQ?: string;
}

// ── Status badge ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: InboxStatus }) {
  const cfg = {
    pending:   { label: "Pending",   bg: "rgba(79,142,247,.12)",   c: "#4f8ef7" },
    approved:  { label: "Approved",  bg: "rgba(52,211,153,.12)",   c: "#34d399" },
    dismissed: { label: "Dismissed", bg: "rgba(120,120,160,.10)",  c: "#7878a0" },
    reviewed:  { label: "Reviewed",  bg: "rgba(251,191,36,.12)",   c: "#fbbf24" },
  }[status] || { label: status, bg: T.b1, c: T.t3 };
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".5px",
      background: cfg.bg, color: cfg.c, borderRadius: 5, padding: "2px 6px",
      textTransform: "uppercase" }}>
      {cfg.label}
    </span>
  );
}

// ── Single inbox card ─────────────────────────────────────────────
function InboxCard({
  item,
  onApprove,
  onDismiss,
  onReview,
  onOpenGroup,
  onCreateTask,
  expanded,
  onToggle,
}: {
  item: InboxItem;
  onApprove: () => void;
  onDismiss: () => void;
  onReview: () => void;
  onOpenGroup: () => void;
  onCreateTask: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const priColor = INBOX_PRIORITY_COLOR[item.priority];
  const priBg    = INBOX_PRIORITY_BG[item.priority];
  const icon     = INBOX_ACTION_ICON[item.type];
  const label    = INBOX_ACTION_LABEL[item.type];
  const isDone   = item.status === "dismissed" || item.status === "approved";

  return (
    <div style={{
      background: T.s2,
      border: `1px solid ${isDone ? T.b1 : T.b2}`,
      borderLeft: `3px solid ${isDone ? T.b2 : priColor}`,
      borderRadius: 12,
      marginBottom: 10,
      opacity: isDone ? 0.55 : 1,
      transition: "opacity .2s",
    }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 14px 10px", cursor: "pointer" }}>
        <div style={{ fontSize: 18, lineHeight: 1, paddingTop: 1 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{item.title}</span>
            <StatusBadge status={item.status} />
          </div>
          <div style={{ fontSize: 11, color: T.t3, marginBottom: 4 }}>{item.summary}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".5px",
              background: priBg, color: priColor, borderRadius: 4, padding: "2px 6px",
              textTransform: "uppercase" }}>
              {item.priority}
            </span>
            <span style={{ fontSize: 9, color: T.t4, background: T.b1,
              borderRadius: 4, padding: "2px 6px" }}>
              {label}
            </span>
            <span style={{ fontSize: 9, color: T.t4 }}>
              {item.confidence === "certain" ? "✓ Certain" : item.confidence === "likely" ? "~ Likely" : "? Possible"}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 14, color: T.t4, paddingTop: 2 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${T.b1}` }}>
          {/* Rationale */}
          <div style={{ padding: "10px 0 8px" }}>
            <div style={{ fontSize: 10, color: T.t4, fontWeight: 700, letterSpacing: ".5px",
              textTransform: "uppercase", marginBottom: 4 }}>Why this matters</div>
            <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.6 }}>{item.rationale}</div>
          </div>

          {/* Suggested payload */}
          {item.suggestedPayload && Object.keys(item.suggestedPayload).some(k => item.suggestedPayload[k]) && (
            <div style={{ background: T.s3, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.t4, fontWeight: 700, letterSpacing: ".5px",
                textTransform: "uppercase", marginBottom: 6 }}>Pre-filled data</div>
              {item.suggestedPayload.contactName && (
                <div style={{ fontSize: 11, color: T.t2, marginBottom: 2 }}>
                  👤 {item.suggestedPayload.contactName}
                </div>
              )}
              {item.suggestedPayload.contactEmail && (
                <div style={{ fontSize: 11, color: T.t2, marginBottom: 2 }}>
                  ✉️ {item.suggestedPayload.contactEmail}
                </div>
              )}
              {item.suggestedPayload.contactPhone && (
                <div style={{ fontSize: 11, color: T.t2, marginBottom: 2 }}>
                  📞 {item.suggestedPayload.contactPhone}
                </div>
              )}
              {item.suggestedPayload.taskTitle && (
                <div style={{ fontSize: 11, color: T.t2, marginBottom: 2 }}>
                  ✅ {item.suggestedPayload.taskTitle}
                </div>
              )}
              {item.suggestedPayload.dueDate && (
                <div style={{ fontSize: 11, color: T.t2 }}>
                  📅 Due {item.suggestedPayload.dueDate}
                </div>
              )}
            </div>
          )}

          {/* Signal source */}
          <div style={{ fontSize: 10, color: T.t4, marginBottom: 10, fontFamily: "monospace",
            background: T.b1, borderRadius: 6, padding: "4px 8px" }}>
            Source: {item.source}
          </div>

          {/* Actions */}
          {item.status === "pending" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {item.type === "create_task" ? (
                <button onClick={onCreateTask} style={{
                  flex: 1, minWidth: 100, padding: "9px 14px", background: "#34d399",
                  color: "#0a0a0f", border: "none", borderRadius: 8, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                  ✅ Create Task
                </button>
              ) : (
                <button onClick={onApprove} style={{
                  flex: 1, minWidth: 100, padding: "9px 14px", background: T.blue,
                  color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                  ✓ Approve
                </button>
              )}
              <button onClick={onOpenGroup} style={{
                padding: "9px 14px", background: T.s3, color: T.t2,
                border: `1px solid ${T.b2}`, borderRadius: 8, cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                Open Account
              </button>
              <button onClick={onReview} style={{
                padding: "9px 14px", background: "none", color: T.t3,
                border: `1px solid ${T.b1}`, borderRadius: 8, cursor: "pointer",
                fontFamily: "inherit", fontSize: 11 }}>
                Mark Reviewed
              </button>
              <button onClick={onDismiss} style={{
                padding: "9px 14px", background: "none", color: T.t4,
                border: "none", borderRadius: 8, cursor: "pointer",
                fontFamily: "inherit", fontSize: 11 }}>
                Dismiss
              </button>
            </div>
          )}

          {(item.status === "approved" || item.status === "reviewed") && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onOpenGroup} style={{
                padding: "8px 14px", background: T.s3, color: T.t2,
                border: `1px solid ${T.b2}`, borderRadius: 8, cursor: "pointer",
                fontFamily: "inherit", fontSize: 12 }}>
                Open Account
              </button>
              <button onClick={onDismiss} style={{
                padding: "8px 14px", background: "none", color: T.t4,
                border: "none", borderRadius: 8, cursor: "pointer",
                fontFamily: "inherit", fontSize: 11 }}>
                Dismiss
              </button>
            </div>
          )}

          {item.status === "dismissed" && (
            <button onClick={onApprove} style={{
              padding: "8px 14px", background: "none", color: T.t4,
              border: `1px solid ${T.b1}`, borderRadius: 8, cursor: "pointer",
              fontFamily: "inherit", fontSize: 11 }}>
              Restore
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────
export default function InboxTab({
  groups,
  overlays,
  patchOverlay,
  tasks,
  goGroup,
  onAddTask,
  activeQ = "1",
}: InboxTabProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const allItems = useMemo(
    () => buildInboxItems(groups, overlays, tasks, { qk: activeQ, maxItems: 10 }),
    [groups, overlays, tasks, activeQ]
  );

  const shown = useMemo(() => {
    if (filter === "pending") return allItems.filter(i => i.status === "pending");
    if (filter === "done")    return allItems.filter(i => i.status !== "pending");
    return allItems;
  }, [allItems, filter]);

  const pendingCount = allItems.filter(i => i.status === "pending").length;

  const updateStatus = async (item: InboxItem, status: InboxStatus) => {
    setSaving(item.id);
    const current: any[] = overlays?.inboxItems || [];
    const updated = current.filter((i: any) => i.id !== item.id);
    updated.push({ id: item.id, status, updatedAt: new Date().toISOString() });
    await patchOverlay([{ op: "set", path: "inboxItems", value: updated }]);
    setSaving(null);
  };

  const handleCreateTask = (item: InboxItem) => {
    const payload = item.suggestedPayload || {};
    const group   = groups.find(g => g.id === item.groupId);
    onAddTask({
      title:   payload.taskTitle || `Follow up with ${item.groupName}`,
      dueDate: payload.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      groupId: item.groupId,
      groupName: item.groupName,
      notes:   item.rationale,
    }, null, group);
    updateStatus(item, "approved");
  };

  return (
    <div style={{ padding: "16px 16px 90px" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>📬</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.t1 }}>Assistant Inbox</span>
          {pendingCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, background: T.blue,
              color: "#fff", borderRadius: 10, padding: "1px 7px", minWidth: 20,
              textAlign: "center" }}>
              {pendingCount}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.t3 }}>
          Proposed actions based on account signals. You approve — nothing happens automatically.
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["pending", "all", "done"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 11, fontWeight: 700,
            border: filter === f ? "none" : `1px solid ${T.b2}`,
            background: filter === f ? T.blue : "none",
            color: filter === f ? "#fff" : T.t3,
            textTransform: "capitalize",
          }}>
            {f === "pending" ? `Pending (${pendingCount})` : f === "all" ? `All (${allItems.length})` : "Done"}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {shown.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: T.t4 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>
            {filter === "pending" ? "✅" : "📬"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.t3, marginBottom: 6 }}>
            {filter === "pending" ? "No pending actions" : "Inbox empty"}
          </div>
          <div style={{ fontSize: 12 }}>
            {filter === "pending"
              ? "All caught up. Switch to "All" to see everything."
              : "Actions will appear here as signals develop."}
          </div>
        </div>
      )}

      {/* Items */}
      {shown.map(item => (
        <div key={item.id} style={{ position: "relative" }}>
          {saving === item.id && (
            <div style={{ position: "absolute", inset: 0, zIndex: 5,
              background: "rgba(10,10,15,.5)", borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11, color: T.t3 }}>Saving…</span>
            </div>
          )}
          <InboxCard
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onApprove={() => updateStatus(item, "approved")}
            onDismiss={() => updateStatus(item, "dismissed")}
            onReview={() => updateStatus(item, "reviewed")}
            onOpenGroup={() => goGroup(item.groupId)}
            onCreateTask={() => handleCreateTask(item)}
          />
        </div>
      ))}
    </div>
  );
}
