import { NextRequest, NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO      = "kscott244/accel-v7";
const FILE_PATH = "data/crm-accounts.json";

export async function POST(req: NextRequest) {
  try {
    if (!GITHUB_PAT) {
      return NextResponse.json({ error: "No GitHub PAT configured" }, { status: 500 });
    }

    const { crm } = await req.json();
    if (!crm) {
      return NextResponse.json({ error: "Missing crm payload" }, { status: 400 });
    }

    // Get current SHA if file exists (required for GitHub PUT)
    let fileSha: string | null = null;
    const getRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      { headers: { Authorization: `token ${GITHUB_PAT}`, "User-Agent": "accel-v7" } }
    );
    if (getRes.ok) {
      const fileData = await getRes.json();
      fileSha = fileData.sha;
    } else if (getRes.status !== 404) {
      return NextResponse.json({ error: "Failed to fetch current CRM SHA" }, { status: 500 });
    }
    // 404 = file doesn't exist yet — create it (no SHA needed for first write)

    const updated = { ...crm, lastUpdated: new Date().toISOString() };
    const newContent = Buffer.from(JSON.stringify(updated, null, 2)).toString("base64");

    const putBody: any = {
      message: `crm: save — ${new Date().toISOString().slice(0, 10)}`,
      content: newContent,
    };
    if (fileSha) putBody.sha = fileSha;

    const putRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_PAT}`,
          "Content-Type": "application/json",
          "User-Agent": "accel-v7",
        },
        body: JSON.stringify(putBody),
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
      accountCount: Object.keys(updated.accounts || {}).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
