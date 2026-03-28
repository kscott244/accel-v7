import { NextRequest, NextResponse } from "next/server";

const GITHUB_API = "https://api.github.com";
const REPO       = "kscott244/accel-v7";
const FILE_PATH  = "src/data/manual-parents.json";
const PAT        = process.env.GITHUB_PAT || "";

export async function POST(req: NextRequest) {
  try {
    const { id, entry } = await req.json();
    if (!id || !entry) return NextResponse.json({ error: "Missing id or entry" }, { status: 400 });

    // 1. Get current file + SHA
    const getRes = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${FILE_PATH}`, {
      headers: { Authorization: `token ${PAT}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!getRes.ok) return NextResponse.json({ error: "Failed to fetch current file" }, { status: 500 });
    const current = await getRes.json();
    const existing = JSON.parse(Buffer.from(current.content, "base64").toString("utf-8"));

    // 2. Merge new entry
    const updated = { ...existing, [id]: entry };
    const newContent = Buffer.from(JSON.stringify(updated, null, 2)).toString("base64");

    // 3. Commit
    const putRes = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: { Authorization: `token ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `practices: update ${entry.name} (${(entry.childIds||[]).length} accounts)`,
        content: newContent,
        sha: current.sha,
      }),
    });
    if (!putRes.ok) {
      const err = await putRes.json();
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const result = await putRes.json();
    return NextResponse.json({ ok: true, sha: result.commit?.sha });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
