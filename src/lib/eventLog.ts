// ─── EVENT LOG ───────────────────────────────────────────────────────────────
// Lightweight event layer for meaningful app actions.
// Events are stored in localStorage only (ring buffer, max 200).
// Never written to GitHub — too frequent for overlay persistence.
// Account memory (summary signals) is derived from events and IS written to overlays.
//
// Rule: only log events that are meaningful to future prioritization.
// Do NOT log every scroll or render. Log intentional user actions.

// ── Event types ───────────────────────────────────────────────────
export type AppEventType =
  | "group:viewed"           // opened a group detail
  | "group:researched"       // ran deep research on a group
  | "contact:added"          // manually added a contact
  | "contact:edited"         // edited an existing contact
  | "contact:marked_primary" // marked a contact as primary
  | "task:created"           // created a task
  | "task:completed"         // completed a task
  | "task:deleted"           // deleted a task
  | "note:updated"           // saved group notes
  | "intel:updated"          // saved War Room intel (status, strategy, etc.)
  | "pin:toggled"            // pinned or unpinned a War Room account
  | "merge:executed"         // merged two groups
  | "csv:uploaded";          // uploaded a new CSV

export interface AppEvent {
  id: string;          // short uuid
  type: AppEventType;
  groupId?: string;    // Master-CM# if relevant
  groupName?: string;  // display name at time of event
  detail?: string;     // optional human-readable detail
  ts: string;          // ISO timestamp
}

// ── Storage key + max ring buffer size ───────────────────────────
const LS_KEY = "accel_events_v1";
const MAX_EVENTS = 200;

// ── Generate a short ID ───────────────────────────────────────────
function shortId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ── Read all events from localStorage ────────────────────────────
export function readEvents(): AppEvent[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

// ── Log a new event ───────────────────────────────────────────────
// Silently no-ops if localStorage is unavailable (SSR).
export function logEvent(type: AppEventType, opts: {
  groupId?: string;
  groupName?: string;
  detail?: string;
} = {}): AppEvent | null {
  if (typeof window === "undefined") return null;
  const event: AppEvent = {
    id: shortId(),
    type,
    ts: new Date().toISOString(),
    ...opts,
  };
  try {
    const existing = readEvents();
    const next = [...existing, event].slice(-MAX_EVENTS);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
  return event;
}

// ── Query events for a specific group ────────────────────────────
export function eventsForGroup(groupId: string): AppEvent[] {
  return readEvents().filter(e => e.groupId === groupId);
}

// ── Last event of a given type for a group ────────────────────────
export function lastEventOfType(groupId: string, type: AppEventType): AppEvent | null {
  const evts = eventsForGroup(groupId).filter(e => e.type === type);
  return evts.length > 0 ? evts[evts.length - 1] : null;
}

// ── Derive lightweight attention signal from recent events ────────
// Returns 0–10. Higher = more recent focused activity.
export function attentionScore(groupId: string): number {
  const now = Date.now();
  const evts = eventsForGroup(groupId);
  if (evts.length === 0) return 0;
  let score = 0;
  const ACTION_WEIGHTS: Partial<Record<AppEventType, number>> = {
    "contact:added":          3,
    "contact:marked_primary": 2,
    "contact:edited":         1,
    "note:updated":           2,
    "intel:updated":          2,
    "task:created":           2,
    "task:completed":         3,
    "group:researched":       2,
    "pin:toggled":            1,
    "merge:executed":         3,
    "group:viewed":           0.5,
  };
  for (const e of evts) {
    const ageDays = (now - new Date(e.ts).getTime()) / 86400000;
    const decay = ageDays < 1 ? 1 : ageDays < 7 ? 0.7 : ageDays < 30 ? 0.3 : 0.1;
    score += (ACTION_WEIGHTS[e.type] ?? 0) * decay;
  }
  return Math.min(10, Math.round(score * 10) / 10);
}
