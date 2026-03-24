import { NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO      = "kscott244/accel-v7";
const FILE_PATH = "data/sales-history.json";

export async function GET() {
  try {
    if (!GITHUB_PAT) {
      return NextResponse.json({ error: "No GitHub PAT configured" }, { status: 500 });
    }

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
      { headers: { Authorization: `token ${GITHUB_PAT}`, "User-Agent": "accel-v7" } }
    );

    // 404 = file doesn't exist yet — return null store, not an error
    if (res.status === 404) {
      return NextResponse.json({ sales: null, sha: null });
    }

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to load sales history from GitHub" }, { status: 500 });
    }

    const fileData = await res.json();
    const content  = JSON.parse(
      Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString()
    );

    return NextResponse.json({ sales: content, sha: fileData.sha });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
