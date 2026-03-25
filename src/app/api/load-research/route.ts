import { NextRequest, NextResponse } from "next/server";

const FOLDER_NAME = "Accelerate Research";
const FILE_NAME = "research-cache.json";

async function getAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token || null;
}

export async function POST(req: NextRequest) {
  try {
    const { refreshToken, accountIds } = await req.json();

    if (!refreshToken) return NextResponse.json({ error: "No refresh token" }, { status: 401 });

    const accessToken = await getAccessToken(refreshToken);
    if (!accessToken) return NextResponse.json({ error: "Failed to get access token" }, { status: 401 });

    // Find the folder
    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&spaces=drive&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const folderData = await folderRes.json();

    if (!folderData.files?.length) {
      return NextResponse.json({ accounts: {}, totalCached: 0, message: "No research cache found" });
    }

    const folderId = folderData.files[0].id;

    // Find the cache file
    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and '${folderId}' in parents and trashed=false&spaces=drive&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const fileData = await fileRes.json();

    if (!fileData.files?.length) {
      return NextResponse.json({ accounts: {}, totalCached: 0, message: "No research cache file found" });
    }

    // Download the file content
    const contentRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileData.files[0].id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const cache = await contentRes.json();

    // If specific accountIds requested, filter
    if (accountIds?.length) {
      const filtered: Record<string, any> = {};
      for (const id of accountIds) {
        if (cache.accounts?.[id]) filtered[id] = cache.accounts[id];
      }
      return NextResponse.json({
        accounts: filtered,
        totalCached: Object.keys(cache.accounts || {}).length,
        returned: Object.keys(filtered).length,
        lastUpdated: cache.lastUpdated,
      });
    }

    // Return everything
    return NextResponse.json({
      accounts: cache.accounts || {},
      totalCached: Object.keys(cache.accounts || {}).length,
      lastUpdated: cache.lastUpdated,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
