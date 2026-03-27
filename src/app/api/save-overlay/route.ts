import { NextRequest, NextResponse } from "next/server";
import { applyOps, validateOverlayIntegrity } from "@/lib/overlayOps";
import type { OverlayOp } from "@/lib/overlayOps";

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO = "kscott244/accel-v7";
const FILE_PATH = "data/overlays.json";

// Load base groups for integrity validation (server-side only)
let _baseGroups: any[] | null = null;
function getBaseGroups(): any[] {
  if (!_baseGroups) {
    try {
      const { PRELOADED } = require("@/data/preloaded-data");
      _baseGroups = PRELOADED?.groups || [];
    } catch {
      _baseGroups = [];
    }
  }
  return _baseGroups;
}

// ─── FETCH CURRENT OVERLAY FROM GITHUB ──────────────────────────────────────
async function fetchCurrentOverlay(): Promise<{ overlay: any; sha: string } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
    { headers: { Authorization: `token ${GITHUB_PAT}`, "User-Agent": "accel-v7" } }
  );
  if (!res.ok) return null;
  const fileData = await res.json();
  const content = JSON.parse(
    Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString()
  );
  return { overlay: content, sha: fileData.sha };
}

// ─── COMMIT TO GITHUB ───────────────────────────────────────────────────────
async function commitOverlay(overlay: any, sha: string): Promise<{ success: boolean; commit?: string; error?: string }> {
  const newContent = Buffer.from(JSON.stringify(overlay, null, 2)).toString("base64");
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_PAT}`,
        "Content-Type": "application/json",
        "User-Agent": "accel-v7",
      },
      body: JSON.stringify({
        message: `overlay: save — ${new Date().toISOString().slice(0, 10)}`,
        content: newContent,
        sha,
      }),
    }
  );
  if (!res.ok) {
    const errData = await res.json();
    return { success: false, error: errData.message || "GitHub commit failed" };
  }
  const putData = await res.json();
  return { success: true, commit: putData.commit?.sha?.slice(0, 10) };
}

export async function POST(req: NextRequest) {
  try {
    if (!GITHUB_PAT) {
      return NextResponse.json({ error: "No GitHub PAT configured" }, { status: 500 });
    }

    const body = await req.json();

    // ── PATCH MODE (new): client sends ops array ──────────────────────
    if (body.ops && Array.isArray(body.ops)) {
      const ops: OverlayOp[] = body.ops;
      if (ops.length === 0) {
        return NextResponse.json({ error: "Empty ops array" }, { status: 400 });
      }

      // 1. Read current overlay from GitHub (always fresh)
      const current = await fetchCurrentOverlay();
      if (!current) {
        return NextResponse.json({ error: "Failed to fetch current overlay from GitHub" }, { status: 500 });
      }

      // 2. Apply operations to current overlay
      const updated = { ...current.overlay };
      applyOps(updated, ops);
      updated.lastUpdated = new Date().toISOString();

      // 3. Integrity guard
      const baseGroups = getBaseGroups();
      if (baseGroups.length > 0) {
        const report = validateOverlayIntegrity(baseGroups, updated);
        if (report.blocked) {
          const blockViolations = report.violations.filter(v => v.severity === "block");
          return NextResponse.json(
            {
              error: "INTEGRITY_GUARD: " + blockViolations.map(v => v.detail).join(" | "),
              code: "OVERLAY_INTEGRITY_BLOCKED",
              violations: blockViolations,
            },
            { status: 422 }
          );
        }
      }

      // 4. Commit to GitHub
      const result = await commitOverlay(updated, current.sha);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        commit: result.commit,
        overlays: updated,
      });
    }

    // ── LEGACY MODE: client sends full overlay (backward compat) ─────
    // This path is DEPRECATED. All new code should use ops.
    const { overlays } = body;
    if (!overlays) {
      return NextResponse.json({ error: "Missing overlays payload or ops array" }, { status: 400 });
    }

    const current = await fetchCurrentOverlay();
    if (!current) {
      return NextResponse.json({ error: "Failed to fetch current overlay from GitHub" }, { status: 500 });
    }

    // Write guard: refuse wipe
    const currentGroups = Object.keys(current.overlay.groups || {}).length;
    const incomingGroups = Object.keys(overlays.groups || {}).length;
    if (incomingGroups === 0 && currentGroups > 0) {
      return NextResponse.json(
        {
          error: "WRITE_GUARD: incoming overlay has 0 groups but current has " +
            currentGroups + ". Refusing to overwrite. Reload the app.",
          code: "OVERLAY_WIPE_PREVENTED",
        },
        { status: 409 }
      );
    }

    // Integrity guard
    const baseGroups = getBaseGroups();
    if (baseGroups.length > 0) {
      const report = validateOverlayIntegrity(baseGroups, overlays);
      if (report.blocked) {
        const blockViolations = report.violations.filter(v => v.severity === "block");
        return NextResponse.json(
          {
            error: "INTEGRITY_GUARD: " + blockViolations.map(v => v.detail).join(" | "),
            code: "OVERLAY_INTEGRITY_BLOCKED",
            violations: blockViolations,
          },
          { status: 422 }
        );
      }
    }

    const updated = { ...overlays, lastUpdated: new Date().toISOString() };
    const result = await commitOverlay(updated, current.sha);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      commit: result.commit,
      overlays: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
