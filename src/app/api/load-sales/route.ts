import { NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO       = "kscott244/accel-v7";
const FILE_PATH  = "data/sales-history.json";

// ─── LARGE-FILE SAFE LOADER ──────────────────────────────────────────────────
// GitHub Contents API silently returns content:"" for files > 1 MB (200 OK).
// JSON.parse("") throws, which previously produced a silent 500 the app ignored.
//
// Fix: use Contents API only to get the blob SHA (metadata always returns),
// then fetch actual bytes via the Git Blob API which handles files up to 100 MB.
async function fetchLargeJson(pat: string, repo: string, filePath: string) {
  // Step 1: metadata — Contents API is fine here regardless of file size
  const metaRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}`,
    { headers: { Authorization: `token ${pat}`, "User-Agent": "accel-v7" } }
  );

  if (metaRes.status === 404) return { notFound: true as const };

  if (!metaRes.ok) {
    const txt = await metaRes.text().catch(() => "");
    throw new Error(`Contents API failed (${metaRes.status}): ${txt.slice(0, 200)}`);
  }

  const meta = await metaRes.json();
  const blobSha: string | undefined = meta.sha;
  if (!blobSha) throw new Error("Contents API response missing blob SHA");

  // Step 2: content — Git Blob API handles up to 100 MB
  const blobRes = await fetch(
    `https://api.github.com/repos/${repo}/git/blobs/${blobSha}`,
    { headers: { Authorization: `token ${pat}`, "User-Agent": "accel-v7" } }
  );

  if (!blobRes.ok) {
    const txt = await blobRes.text().catch(() => "");
    throw new Error(`Blob API failed (${blobRes.status}): ${txt.slice(0, 200)}`);
  }

  const blob = await blobRes.json();
  if (!blob.content) throw new Error("Blob API returned empty content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString());
  } catch (e: any) {
    throw new Error(`JSON parse failed: ${e.message}`);
  }

  return { data: parsed, sha: blobSha };
}

export async function GET() {
  try {
    if (!GITHUB_PAT) {
      return NextResponse.json({ error: "No GitHub PAT configured" }, { status: 500 });
    }

    const result = await fetchLargeJson(GITHUB_PAT, REPO, FILE_PATH);

    if ("notFound" in result) {
      // File not yet created — first-run case, not an error
      return NextResponse.json({ sales: null, sha: null });
    }

    return NextResponse.json({ sales: result.data, sha: result.sha });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
