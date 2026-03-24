// ─── WEEKLY DELTA ─────────────────────────────────────────────────
// Computes what changed between two CSV uploads.
// Snapshot: { q: string, cy: Record<id, number>, py: Record<id, number>, uploadedAt: string }
// Stored in localStorage("weekly_snapshot_v1").

export interface WeeklySnapshot {
  q: string;
  cy: Record<string, number>;
  py: Record<string, number>;
  uploadedAt: string;
}

export interface DeltaItem {
  id: string;
  name: string;
  gName?: string;
  city?: string;
  st?: string;
  prevCY: number;
  currCY: number;
  diff: number;
  py: number;
}

export interface WeeklyDelta {
  snapshotAge: string;       // e.g. "3 days ago"
  reactivated: DeltaItem[];  // was $0, now has revenue
  wentDark: DeltaItem[];     // had revenue, now $0
  bigMovers: DeltaItem[];    // |diff| > $300, sorted by abs diff desc
  q: string;
}

function ageLabel(uploadedAt: string): string {
  const ms = Date.now() - new Date(uploadedAt).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export function buildSnapshot(accounts: any[], q: string): WeeklySnapshot {
  const cy: Record<string, number> = {};
  const py: Record<string, number> = {};
  accounts.forEach(a => {
    cy[a.id] = a.cyQ?.[q] || 0;
    py[a.id] = a.pyQ?.[q] || 0;
  });
  return { q, cy, py, uploadedAt: new Date().toISOString() };
}

export function computeDelta(prev: WeeklySnapshot, accounts: any[], q: string): WeeklyDelta {
  const reactivated: DeltaItem[] = [];
  const wentDark: DeltaItem[] = [];
  const bigMovers: DeltaItem[] = [];

  accounts.forEach(a => {
    const prevCY = prev.cy[a.id] ?? -1;
    if (prevCY === -1) return; // new account, skip
    const currCY = a.cyQ?.[q] || 0;
    const diff = currCY - prevCY;
    const py = a.pyQ?.[q] || 0;
    if (Math.abs(diff) < 1) return; // no change

    const item: DeltaItem = { id: a.id, name: a.name, gName: a.gName, city: a.city, st: a.st, prevCY, currCY, diff, py };

    if (prevCY === 0 && currCY > 0 && py > 0) {
      reactivated.push(item);
    } else if (prevCY > 0 && currCY === 0) {
      wentDark.push(item);
    } else if (Math.abs(diff) >= 300) {
      bigMovers.push(item);
    }
  });

  reactivated.sort((a, b) => b.currCY - a.currCY);
  wentDark.sort((a, b) => b.prevCY - a.prevCY);
  bigMovers.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    snapshotAge: ageLabel(prev.uploadedAt),
    reactivated: reactivated.slice(0, 8),
    wentDark: wentDark.slice(0, 8),
    bigMovers: bigMovers.slice(0, 8),
    q,
  };
}

export function saveSnapshot(snapshot: WeeklySnapshot): void {
  try { localStorage.setItem("weekly_snapshot_v1", JSON.stringify(snapshot)); } catch {}
}

export function loadSnapshot(): WeeklySnapshot | null {
  try {
    const s = localStorage.getItem("weekly_snapshot_v1");
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
