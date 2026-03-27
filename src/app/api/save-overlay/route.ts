import { NextRequest, NextResponse } from "next/server";
import { validateOverlayIntegrity } from "@/lib/overlayIntegrity";
import { PRELOADED } from "@/data/preloaded-data";

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO = "kscott244/accel-v7";
const FILE_PATH = "data/overlays.json";

// ─── MEANINGFUL ITEM COUNT ────────────────────────────────────────
// Counts the number of meaningful user-authored items in an overlay object.
// Used by the write guard to detect a dangerously empty incoming payload.
// Sections counted: groups, groupMoves, nameOverrides, contacts, fscReps,
// groupContacts, groupDetaches, skippedCpidIds.
function meaningfulItemCount(ov: any): number {
  if (!ov || typeof ov !== "object") return 0;
  let n = 0;
  n += Object.keys(ov.groups        || {}).length;
  n += Object.keys(ov.groupMoves    || {}).length;
  n += Object.keys(ov.nameOverrides || {}).length;
  n += Object.keys(ov.contacts      || {}).length;
  n += Object.keys(ov.fscReps       || {}).length;
  n += Object.keys(ov.groupContacts || {}).length;
  n += (ov.groupDetaches    || []).length;
  n += (ov.skippedCpidIds   || []).length;
  return n;
}

export async function POST(req: NextRequest) {
  try {
    if (!GITHUB_PAT) {
      return NextResponse.json({ error: "No GitHub PAT configured" }, { status: 500 });
    }

    const { overlays } = await req.json();
    if (!overlays) {
      return NextResponse.json({ error: "Missing overlays payload" }, { status: 400 });
    }

    // 1. Get current file — SHA required for GitHub PUT, content required for write guard
    const getRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      { headers: { Authorization: `token ${GITHUB_PAT}`, "User-Agent": "accel-v7" } }
    );

    if (!getRes.ok) {
      return NextResponse.json({ error: "Failed to fetch current overlays SHA" }, { status: 500 });
    }

    const fileData = await getRes.json();
    const fileSha = fileData.sha;

    // ── A15.7 WRITE GUARD ────────────────────────────────────────────
    // Refuse to commit a payload that looks empty/near-empty if the current
    // GitHub document has meaningful user-authored data.
    //
    // Protects against the wipe scenario: fresh session with empty localStorage
    // saves EMPTY_OVERLAYS back to GitHub before the background load resolves,
    // silently destroying all merge groups, contacts, and skip history.
    //
    // Guard triggers when:
    //   - incoming has 0 groups AND fewer than 3 total meaningful items
    //   - AND current GitHub document has 3+ meaningful items
    //
    // The incoming threshold of 3 (not 0) catches the case where a payload has
    // skippedCpidIds or adjs but no groups — still suspiciously thin.
    // The current threshold of 3 avoids blocking genuinely fresh installs where
    // the GitHub file itself is empty/new.
    try {
      const currentContent = JSON.parse(
        Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString()
      );
      const currentCount  = meaningfulItemCount(currentContent);
      const incomingCount = meaningfulItemCount(overlays);
      const incomingGroups = Object.keys(overlays.groups || {}).length;

      const currentGroups = Object.keys(currentContent.groups || {}).length;
      // Block if: incoming drops all groups but current has groups (group wipe)
      // OR incoming has 0 groups + thin payload but current has meaningful data
      const groupWipe = incomingGroups === 0 && currentGroups > 0;
      const thinWipe  = incomingGroups === 0 && incomingCount < 3 && currentCount >= 3;
      if (groupWipe || thinWipe) {
        return NextResponse.json(
          {
            error: "WRITE_GUARD: incoming overlay has 0 groups but current GitHub overlay has " +
              currentGroups + " groups and " + currentCount + " items. Refusing to overwrite. " +
              "This usually means the app saved before overlay data finished loading. " +
              "Reload the app to re-sync — your data on GitHub is intact.",
            code: "OVERLAY_WIPE_PREVENTED",
            currentGroups,
            currentCount,
            incomingCount,
          },
          { status: 409 }
        );
      }
    } catch {
      // If we can't decode the current file to check, allow the write —
      // better to risk an overwrite than to block legitimate saves due to a
      // decode error. (This path should be very rare.)
    }
    // ── END WRITE GUARD ──────────────────────────────────────────────

    // ── INTEGRITY GUARD ───────────────────────────────────────────────
    // Prevents saving overlays that contain structural corruption:
    //   - A parent CM of a 3+ child base group listed as a childId (org absorption)
    //   - Same childId claimed by multiple overlay groups
    //   - Detached accounts re-merged into a group
    try {
      const baseGroups = PRELOADED?.groups || [];
      if (baseGroups.length > 0) {
        const report = validateOverlayIntegrity(baseGroups, overlays);
        if (report.blocked) {
          const blockViolations = report.violations.filter(v => v.severity === "block");
          return NextResponse.json(
            {
              error: "INTEGRITY_GUARD: overlay contains structural violations that would corrupt data. " +
                blockViolations.map(v => v.detail).join(" | "),
              code: "OVERLAY_INTEGRITY_BLOCKED",
              violations: blockViolations,
            },
            { status: 422 }
          );
        }
        // Warnings are logged but don't block the save
        const warnings = report.violations.filter(v => v.severity === "warn");
        if (warnings.length > 0) {
          console.warn("[overlay-integrity] Warnings:", warnings.map(w => w.detail));
        }
      }
    } catch {
      // If integrity check fails (e.g. PRELOADED not available), allow the write
      // rather than blocking legitimate saves.
    }
    // ── END INTEGRITY GUARD ───────────────────────────────────────────

    // 2. Stamp the update time
    const updated = {
      ...overlays,
      lastUpdated: new Date().toISOString(),
    };

    // 3. Commit to GitHub
    const newContent = Buffer.from(JSON.stringify(updated, null, 2)).toString("base64");
    const putRes = await fetch(
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
          sha: fileSha,
        }),
      }
    );

    if (!putRes.ok) {
      const errData = await putRes.json();
      return NextResponse.json(
        { error: errData.message || "GitHub commit failed" },
        { status: 500 }
      );
    }

    const putData = await putRes.json();
    return NextResponse.json({
      success: true,
      commit: putData.commit?.sha?.slice(0, 10),
      overlays: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
