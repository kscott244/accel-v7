"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
import { fixGroupName } from "@/components/primitives";

const ACTIONS = ["Follow up call", "Schedule visit", "Send promo", "Demo", "Other"];
const PRIORITIES = ["High", "Normal", "Low"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}`;
}

function isOverdue(d: string) {
  return d && d < todayStr();
}

function isToday(d: string) {
  return d === todayStr();
}

function gcalUrl(task: any) {
  const title = encodeURIComponent(
    `${task.action}: ${task.accountName || task.groupName || "Account"}`
  );
  const details = encodeURIComponent(task.notes || "");
  const date = (task.dueDate || todayStr()).replace(/-/g, "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${date}&details=${details}`;
}

// ── ADD TASK MODAL ────────────────────────────────────────────────
function AddTaskModal({ onSave, onClose, defaultAccount = null, defaultGroup = null }) {
  const [action, setAction] = useState("Follow up call");
  const [dueDate, setDueDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("Normal");

  const accountLabel = defaultAccount?.name || defaultGroup ? fixGroupName(defaultGroup) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,.7)", display: "flex",
      alignItems: "flex-end", justifyContent: "center"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520,
        background: T.bg, borderRadius: "20px 20px 0 0",
        padding: "20px 20px 40px", borderTop: `1px solid ${T.b1}`
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>New Task</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.t4, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {accountLabel && (
          <div style={{ fontSize: 11, color: T.cyan, marginBottom: 12, padding: "6px 10px", background: `${T.cyan}12`, borderRadius: 8, border: `1px solid ${T.cyan}30` }}>
            📍 {accountLabel}
          </div>
        )}

        {/* Action */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.t4, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Action</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ACTIONS.map(a => (
              <button key={a} onClick={() => setAction(a)} style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                background: action === a ? `${T.blue}22` : T.s1,
                border: `1px solid ${action === a ? T.blue + "55" : T.b2}`,
                color: action === a ? T.blue : T.t3
              }}>{a}</button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.t4, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Due Date</div>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 10, fontSize: 13,
              background: T.s1, border: `1px solid ${T.b2}`, color: T.t1,
              fontFamily: "inherit", boxSizing: "border-box"
            }} />
        </div>

        {/* Priority */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.t4, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Priority</div>
          <div style={{ display: "flex", gap: 6 }}>
            {PRIORITIES.map(p => {
              const col = p === "High" ? T.red : p === "Normal" ? T.blue : T.t4;
              return (
                <button key={p} onClick={() => setPriority(p)} style={{
                  padding: "5px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  background: priority === p ? `${col}22` : T.s1,
                  border: `1px solid ${priority === p ? col + "55" : T.b2}`,
                  color: priority === p ? col : T.t3
                }}>{p}</button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.t4, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Notes (optional)</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Add context..."
            rows={2}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 10, fontSize: 12,
              background: T.s1, border: `1px solid ${T.b2}`, color: T.t1,
              fontFamily: "inherit", resize: "none", boxSizing: "border-box"
            }} />
        </div>

        <button onClick={() => onSave({ action, dueDate, notes, priority })}
          style={{
            width: "100%", padding: "12px", borderRadius: 12,
            background: T.blue, color: "#fff", border: "none",
            fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
          }}>
          Save Task
        </button>
      </div>
    </div>
  );
}

// ── TASK CARD ─────────────────────────────────────────────────────
function TaskCard({ task, onComplete, onDelete }) {
  const overdue = isOverdue(task.dueDate);
  const today = isToday(task.dueDate);
  const priorityCol = task.priority === "High" ? T.red : task.priority === "Normal" ? T.blue : T.t4;
  const dateCol = overdue ? T.red : today ? T.amber : T.t4;

  return (
    <div style={{
      background: T.s1, borderRadius: 14, padding: "12px 14px", marginBottom: 8,
      border: `1px solid ${task.completed ? T.b1 : priorityCol + "22"}`,
      borderLeft: `3px solid ${task.completed ? T.b2 : priorityCol}`,
      opacity: task.completed ? 0.5 : 1
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Checkbox */}
        <button onClick={() => onComplete(task.id)} style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
          border: `2px solid ${task.completed ? T.green : T.b2}`,
          background: task.completed ? T.green : "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {task.completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: task.completed ? T.t4 : T.t1, textDecoration: task.completed ? "line-through" : "none" }}>
            {task.action}
          </div>
          {(task.accountName || task.groupName) && (
            <div style={{ fontSize: 11, color: T.cyan, marginTop: 2 }}>
              {task.accountName || task.groupName}
            </div>
          )}
          {task.notes && (
            <div style={{ fontSize: 11, color: T.t3, marginTop: 3, fontStyle: "italic" }}>{task.notes}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: dateCol }}>
              {overdue ? `⚠ ${formatDate(task.dueDate)}` : today ? "Today" : formatDate(task.dueDate)}
            </span>
            {task.priority === "High" && (
              <span style={{ fontSize: 9, fontWeight: 700, color: T.red, background: `${T.red}15`, borderRadius: 4, padding: "1px 6px", border: `1px solid ${T.red}30` }}>HIGH</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {/* Add to Google Calendar */}
          <a href={gcalUrl(task)} target="_blank" rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 8,
              background: `${T.blue}18`, border: `1px solid ${T.blue}30`,
              color: T.blue, textDecoration: "none", fontSize: 14
            }} title="Add to Google Calendar">
            📅
          </a>
          {/* Delete */}
          <button onClick={() => onDelete(task.id)} style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${T.red}12`, border: `1px solid ${T.red}25`,
            color: T.red, cursor: "pointer", fontSize: 14
          }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function TasksTab({ tasks, onAddTask, onCompleteTask, onDeleteTask }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("active"); // active | completed | all

  const sorted = useMemo(() => {
    let list = [...(tasks || [])];
    if (filter === "active") list = list.filter(t => !t.completed);
    else if (filter === "completed") list = list.filter(t => t.completed);
    // Sort: overdue first, then today, then future, completed last
    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.dueDate < b.dueDate) return -1;
      if (a.dueDate > b.dueDate) return 1;
      return 0;
    });
    return list;
  }, [tasks, filter]);

  const overdueCount = (tasks || []).filter(t => !t.completed && isOverdue(t.dueDate)).length;
  const todayCount = (tasks || []).filter(t => !t.completed && isToday(t.dueDate)).length;

  return (
    <div style={{ padding: "0 0 80px" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.t1 }}>Tasks</div>
          <div style={{ fontSize: 11, color: T.t4, marginTop: 2 }}>
            {overdueCount > 0 && <span style={{ color: T.red }}>{overdueCount} overdue · </span>}
            {todayCount > 0 && <span style={{ color: T.amber }}>{todayCount} today · </span>}
            {(tasks || []).filter(t => !t.completed).length} open
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          background: T.blue, border: "none", borderRadius: 10,
          padding: "8px 16px", color: "#fff", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit"
        }}>+ Add Task</button>
      </div>

      {/* Filter pills */}
      <div style={{ padding: "0 16px 12px", display: "flex", gap: 6 }}>
        {[["active","Active"],["completed","Done"],["all","All"]].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: "5px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            background: filter === k ? `${T.blue}20` : T.s1,
            border: `1px solid ${filter === k ? T.blue + "44" : T.b2}`,
            color: filter === k ? T.blue : T.t3
          }}>{l}</button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ padding: "0 16px" }}>
        {sorted.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: T.t4, fontSize: 12 }}>
            {filter === "active" ? "No open tasks. Tap + Add Task to create one." : "Nothing here."}
          </div>
        ) : (
          sorted.map(t => (
            <TaskCard key={t.id} task={t} onComplete={onCompleteTask} onDelete={onDeleteTask} />
          ))
        )}
      </div>

      {showAdd && (
        <AddTaskModal
          onClose={() => setShowAdd(false)}
          onSave={(data) => {
            onAddTask(data);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

// Export AddTaskModal so it can be used from GroupDetail / AcctDetail
export { AddTaskModal };
