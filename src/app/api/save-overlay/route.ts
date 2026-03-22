import { NextRequest, NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO = "kscott244/accel-v7";
const FILE_PATH = "data/overlays.json";

export async function POST(req: NextRequest) {
  try {
    if (!GITHUB_PAT) {
      return NextResponse.json({ error: "No GitHub PAT configured" }, { status: 500 });
    }

    const { overlays } = await req.json();
    if (!overlays) {
      return NextResponse.json({ error: "Missing overlays payload" }, { status: 400 });
    }

    // 1. Get current SHA (required for GitHub PUT)
    const getRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      { headers: { Authorization: `token ${GITHUB_PAT}`, "User-Agent": "accel-v7" } }
    );

    if (!getRes.ok) {
      return NextResponse.json({ error: "Failed to fetch current overlays SHA" }, { status: 500 });
    }

    const fileData = await getRes.json();
    const fileSha = fileData.sha;

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
