"use client";
// @ts-nocheck
import { useState, useMemo } from "react";
import { T } from "@/lib/tokens";
import { $$ } from "@/lib/format";
import { fixGroupName } from "@/components/primitives";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysFromNow(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}`;
}
function isOverdue(d: string) { return d && d < todayStr(); }
function isToday(d: string)   { return d === todayStr(); }

function gcalUrl(task: any) {
  const title   = encodeURIComponent(`${task.action}${task.accountName ? `: ${task.accountName}` : task.groupName ? `: ${task.groupName}` : ""}`);
  const details = encodeURIComponent(task.notes || "");
  const date    = (task.dueDate || todayStr()).replace(/-/g, "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${date}&details=${details}`;
}

// ── TASK CARD ─────────────────────────────────────────────────────
function TaskCard({ task, onComplete, onDelete, goAcct }: any) {
  const overdue    = isOverdue(task.dueDate);
  const today      = isToday(task.dueDate);
  const priCol     = task.priority === "High" ? T.red : task.priority === "Normal" ? T.blue : T.t4;
  const dateCol    = overdue ? T.red : today ? T.amber : T.t4;
  const dateLabel  = overdue ? `⚠ overdue ${formatDate(task.dueDate)}` : today ? "Today" : formatDate(task.dueDate);

  return (
    <div style={{
      background: T.s1, borderRadius: 12, padding: "10px 12px", marginBottom: 7,
      border: `1px solid ${task.completed ? T.b1 : priCol + "22"}`,
      borderLeft: `3px solid ${task.completed ? T.b2 : priCol}`,
      opacity: task.completed ? 0.45 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        {/* Checkbox */}
        <button onClick={() => onComplete(task.id)} style={{
          width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
          border: `2px solid ${task.completed ? T.green : T.b2}`,
          background: task.completed ? T.green : "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {task.completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Action text */}
          <div style={{ fontSize: 12, fontWeight: 700, color: task.completed ? T.t4 : T.t1,
            textDecoration: task.completed ? "line-through" : "none", marginBottom: 2 }}>
            {task.action}
          </div>
          {/* Linked account/group — tappable */}
          {(task.accountName || task.groupName) && (
            <div onClick={() => {
              if (goAcct && task.accountId) {
                // Navigate via goAcct — find scored account by id
                goAcct({ id: task.accountId, name: task.accountName, gId: task.groupId, gName: task.groupName });
              }
            }} style={{
              fontSize: 10, color: T.cyan, marginBottom: 3,
              cursor: goAcct && task.accountId ? "pointer" : "default",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              📍 {task.accountName || task.groupName}
              {task.notes && <span style={{ color: T.t4 }}> · {task.notes}</span>}
            </div>
          )}
          {/* Notes (when no account link) */}
          {task.notes && !task.accountName && !task.groupName && (
            <div style={{ fontSize: 10, color: T.t3, marginBottom: 3, fontStyle: "italic" }}>{task.notes}</div>
          )}
          {/* Date + priority */}
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: dateCol }}>{dateLabel}</span>
            {task.priority === "High" && (
              <span style={{ fontSize: 8, fontWeight: 700, color: T.red, background: `${T.red}15`,
                borderRadius: 3, padding: "1px 5px", border: `1px solid ${T.red}25` }}>HIGH</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          <a href={gcalUrl(task)} target="_blank" rel="noreferrer"
            style={{ width: 26, height: 26, borderRadius: 7, background: `${T.blue}18`,
              border: `1px solid ${T.blue}28`, color: T.blue, textDecoration: "none",
              fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Add to Calendar">📅</a>
          <button onClick={() => onDelete(task.id)} style={{
            width: 26, height: 26, borderRadius: 7, background: `${T.red}12`,
            border: `1px solid ${T.red}22`, color: T.red, cursor: "pointer", fontSize: 12,
          }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ── SECTION HEADER ────────────────────────────────────────────────
function Section({ label, color, count, children }: any) {
  if (count === 0) return null;
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0 8px" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "1px", color }}>{label}</span>
        <span style={{ fontSize: 9, color: T.t4, marginLeft: "auto" }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

// ── INLINE ADD FORM ───────────────────────────────────────────────
function InlineAddForm({ onSave, onClose, linkedLabel }: any) {
  const [text, setText] = useState("");
  const [due,  setDue]  = useState(daysFromNow(7));
  const [pri,  setPri]  = useState("Normal");

  return (
    <div style={{ background: T.s2, border: `1px solid ${T.b1}`, borderRadius: 12,
      padding: "12px 14px", marginBottom: 12 }}>
      {linkedLabel && (
        <div style={{ fontSize: 9, color: T.cyan, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
          📍 {linkedLabel}
        </div>
      )}
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder="What do you need to do?"
        autoFocus rows={2}
        style={{ width: "100%", background: T.s1, border: `1px solid ${T.b1}`, borderRadius: 8,
          padding: "8px 10px", fontSize: 12, color: T.t1, fontFamily: "inherit",
          resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <input type="date" value={due} onChange={e => setDue(e.target.value)}
          style={{ flex: 1, background: T.s1, border: `1px solid ${T.b1}`, borderRadius: 8,
            padding: "6px 8px", fontSize: 11, color: T.t1, fontFamily: "inherit", outline: "none" }} />
        {(["High", "Normal", "Low"] as const).map(p => {
          const c = p === "High" ? T.red : p === "Normal" ? T.blue : T.t4;
          return (
            <button key={p} onClick={() => setPri(p)} style={{
              padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              background: pri === p ? `${c}20` : T.s1,
              border: `1px solid ${pri === p ? c + "44" : T.b2}`,
              color: pri === p ? c : T.t3,
            }}>{p}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "8px 0", borderRadius: 8,
          background: T.s1, border: `1px solid ${T.b1}`, color: T.t3,
          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        <button onClick={() => { if (text.trim()) { onSave({ action: text.trim(), dueDate: due, priority: pri, notes: "" }); onClose(); }}}
          style={{ flex: 2, padding: "8px 0", borderRadius: 8,
            background: text.trim() ? T.blue : "rgba(79,142,247,.3)", border: "none",
            color: "#fff", fontSize: 12, fontWeight: 700,
            cursor: text.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          Add Task
        </button>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function TasksTab({ tasks, onAddTask, onCompleteTask, onDeleteTask, goAcct }: any) {
  const [showAdd, setShowAdd] = useState(false);

  const today   = todayStr();
  const active  = (tasks || []).filter((t: any) => !t.completed);
  const done    = (tasks || []).filter((t: any) =>  t.completed);
  const overdue = active.filter((t: any) => isOverdue(t.dueDate)).sort((a: any, b: any) => a.dueDate < b.dueDate ? -1 : 1);
  const todayT  = active.filter((t: any) => isToday(t.dueDate));
  const upcoming = active.filter((t: any) => t.dueDate > today).sort((a: any, b: any) => a.dueDate < b.dueDate ? -1 : 1);
  const noDate  = active.filter((t: any) => !t.dueDate);

  return (
    <div style={{ padding: "0 0 80px" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>Tasks</div>
          <div style={{ fontSize: 10, color: T.t4, marginTop: 1 }}>
            {overdue.length > 0 && <span style={{ color: T.red }}>{overdue.length} overdue · </span>}
            {todayT.length > 0  && <span style={{ color: T.amber }}>{todayT.length} today · </span>}
            {active.length} open
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          background: showAdd ? T.s2 : T.blue, border: `1px solid ${showAdd ? T.b1 : "transparent"}`,
          borderRadius: 9, padding: "7px 14px", color: showAdd ? T.t3 : "#fff",
          fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>{showAdd ? "Cancel" : "+ Add"}</button>
      </div>

      <div style={{ padding: "0 16px" }}>
        {/* Inline add form */}
        {showAdd && <InlineAddForm onSave={onAddTask} onClose={() => setShowAdd(false)} />}

        {/* Empty */}
        {active.length === 0 && done.length === 0 && !showAdd && (
          <div style={{ padding: "40px 0", textAlign: "center", color: T.t4, fontSize: 12 }}>
            No tasks yet. Tap + Add or create one from an account.
          </div>
        )}

        <Section label="Overdue" color={T.red} count={overdue.length}>
          {overdue.map((t: any) => <TaskCard key={t.id} task={t} onComplete={onCompleteTask} onDelete={onDeleteTask} goAcct={goAcct}/>)}
        </Section>

        <Section label="Today" color={T.amber} count={todayT.length}>
          {todayT.map((t: any) => <TaskCard key={t.id} task={t} onComplete={onCompleteTask} onDelete={onDeleteTask} goAcct={goAcct}/>)}
        </Section>

        <Section label="Upcoming" color={T.blue} count={upcoming.length + noDate.length}>
          {[...upcoming, ...noDate].map((t: any) => <TaskCard key={t.id} task={t} onComplete={onCompleteTask} onDelete={onDeleteTask} goAcct={goAcct}/>)}
        </Section>

        {done.length > 0 && (
          <Section label="Completed" color={T.t4} count={done.length}>
            {done.slice(0, 10).map((t: any) => <TaskCard key={t.id} task={t} onComplete={onCompleteTask} onDelete={onDeleteTask} goAcct={goAcct}/>)}
            {done.length > 10 && <div style={{ fontSize: 10, color: T.t4, textAlign: "center", padding: "4px 0" }}>+{done.length - 10} more completed</div>}
          </Section>
        )}
      </div>
    </div>
  );
}

// ── TASK SUGGESTION ENGINE (exported for AcctDetail + GroupDetail) ─
export function suggestTasks(acct: any, qk = "1"): Array<{text: string; notes: string; icon: string}> {
  const suggestions: Array<{text: string; notes: string; icon: string}> = [];
  const py  = acct.pyQ?.[qk] || 0;
  const cy  = acct.cyQ?.[qk] || 0;
  const gap = py - cy;

  // Stopped products — highest value first
  const stopped = (acct.products || [])
    .filter((p: any) => (p[`py${qk}`] || 0) > 200 && (p[`cy${qk}`] || 0) === 0)
    .sort((a: any, b: any) => (b[`py${qk}`] || 0) - (a[`py${qk}`] || 0));
  if (stopped.length === 1) {
    suggestions.push({ icon: "🎯", text: `Re-engage on ${stopped[0].n}`, notes: `Was ${acct._$$(stopped[0][`py${qk}`] || 0)} last year — ask what changed` });
  } else if (stopped.length > 1) {
    suggestions.push({ icon: "🎯", text: `${stopped.length} products stopped — lead with ${stopped[0].n}`, notes: `Was ${acct._$$(stopped[0][`py${qk}`] || 0)} — ask what changed` });
  }

  // Gone dark
  if (acct.last > 90 && py > 500) {
    suggestions.push({ icon: "📞", text: `Follow up — gone dark ${acct.last}d`, notes: `Last order ${acct.last} days ago, ${acct._$$(py)} PY spend` });
  }

  // Gap recovery
  if (gap > 2000 && cy > 0) {
    suggestions.push({ icon: "📈", text: `Close Q1 gap — ${acct._$$(gap)} behind`, notes: `CY ${acct._$$(cy)} vs PY ${acct._$$(py)}` });
  }

  // Tier upsell
  const tier = acct.tier || acct.gTier || "";
  if (tier === "Silver" && py > 2000) {
    suggestions.push({ icon: "⬆️", text: "Pitch Gold tier upgrade", notes: "Gold saves ~6% vs Silver MSRP — worth the conversation" });
  } else if ((tier === "Standard" || !tier) && py > 1500) {
    suggestions.push({ icon: "⬆️", text: "Introduce Accelerate program", notes: `${acct._$$(py)} PY spend — Silver tier would lower their cost` });
  }

  return suggestions.slice(0, 3);
}

// ── TASK WIDGET (rendered inside AcctDetail / GroupDetail) ─────────
export function TaskWidget({ acct, group, tasks, onAddTask }: any) {
  const [showForm, setShowForm] = useState(false);
  const linkedId   = acct?.id   || group?.id;
  const linkedName = acct?.name || (group ? fixGroupName(group) : "");

  // Tasks already linked to this account/group
  const linked = (tasks || []).filter((t: any) =>
    (acct  && t.accountId === acct.id) ||
    (group && t.groupId   === group.id)
  );
  const open = linked.filter((t: any) => !t.completed);
  const done = linked.filter((t: any) =>  t.completed);

  // Suggestions — only for accounts, not groups (no pyQ on groups directly)
  const suggestions = acct ? suggestTasks({ ...acct, _$$: $$ }) : [];

  const handleAdd = (text: string, notes: string, icon: string) => {
    onAddTask({ action: `${icon} ${text}`, notes, dueDate: daysFromNow(7), priority: "Normal" });
  };

  return (
    <div style={{ background: T.s1, border: `1px solid ${T.b1}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: open.length > 0 || suggestions.length > 0 ? 10 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.blue }}>Tasks</span>
          {open.length > 0 && <span style={{ fontSize: 9, color: T.t4, background: T.s2, borderRadius: 10, padding: "1px 6px" }}>{open.length} open</span>}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          background: "rgba(79,142,247,.1)", border: "1px solid rgba(79,142,247,.2)",
          borderRadius: 7, padding: "3px 9px", fontSize: 10, fontWeight: 700,
          color: T.blue, cursor: "pointer", fontFamily: "inherit",
        }}>{showForm ? "Cancel" : "+ Custom"}</button>
      </div>

      {/* Existing open tasks */}
      {open.map((t: any) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "6px 8px", background: T.s2, borderRadius: 8, marginBottom: 5,
          border: `1px solid ${isOverdue(t.dueDate) ? "rgba(248,113,113,.2)" : T.b2}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.action}</div>
            {t.dueDate && <div style={{ fontSize: 9, color: isOverdue(t.dueDate) ? T.red : isToday(t.dueDate) ? T.amber : T.t4 }}>
              {isOverdue(t.dueDate) ? `⚠ overdue ${formatDate(t.dueDate)}` : isToday(t.dueDate) ? "Today" : formatDate(t.dueDate)}
            </div>}
          </div>
        </div>
      ))}
      {done.length > 0 && open.length === 0 && (
        <div style={{ fontSize: 10, color: T.t4, marginBottom: 8 }}>✓ {done.length} completed task{done.length !== 1 ? "s" : ""}</div>
      )}

      {/* Suggested tasks */}
      {suggestions.length > 0 && !showForm && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: T.t4, marginBottom: 6 }}>Suggested</div>
          {suggestions.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
              padding: "7px 9px", background: T.s2, borderRadius: 9, marginBottom: 5,
              border: `1px solid ${T.b2}` }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{s.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.t1 }}>{s.text}</div>
                {s.notes && <div style={{ fontSize: 9, color: T.t3, marginTop: 1 }}>{s.notes}</div>}
              </div>
              <button onClick={() => handleAdd(s.text, s.notes, s.icon)} style={{
                flexShrink: 0, padding: "4px 10px", borderRadius: 6,
                background: "rgba(79,142,247,.12)", border: "1px solid rgba(79,142,247,.25)",
                color: T.blue, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>+ Add</button>
            </div>
          ))}
        </>
      )}

      {/* Custom inline form */}
      {showForm && (
        <InlineAddForm onSave={onAddTask} onClose={() => setShowForm(false)} linkedLabel={linkedName} />
      )}

      {/* Empty state when no suggestions and no tasks */}
      {!showForm && suggestions.length === 0 && open.length === 0 && done.length === 0 && (
        <div style={{ fontSize: 11, color: T.t4, paddingTop: 4 }}>No tasks yet. Tap + Custom to add one.</div>
      )}
    </div>
  );
}

// Keep AddTaskModal export for backward compat
export function AddTaskModal({ onSave, onClose, defaultAccount = null, defaultGroup = null }: any) {
  return <InlineAddForm onSave={onSave} onClose={onClose} linkedLabel={defaultAccount?.name || (defaultGroup ? fixGroupName(defaultGroup) : null)} />;
}
