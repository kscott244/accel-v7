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

async function findOrCreateFolder(accessToken: string): Promise<string> {
  // Search for existing folder
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&spaces=drive&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) return searchData.files[0].id;

  // Create folder
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const folder = await createRes.json();
  return folder.id;
}

async function findFile(accessToken: string, folderId: string): Promise<{ id: string; content: any } | null> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and '${folderId}' in parents and trashed=false&spaces=drive&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (!searchData.files?.length) return null;

  const fileId = searchData.files[0].id;
  const contentRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const content = await contentRes.json();
  return { id: fileId, content };
}

export async function POST(req: NextRequest) {
  try {
    const { refreshToken, researchData, accountId } = await req.json();

    if (!refreshToken) return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    if (!researchData || !accountId) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const accessToken = await getAccessToken(refreshToken);
    if (!accessToken) return NextResponse.json({ error: "Failed to get access token" }, { status: 401 });

    const folderId = await findOrCreateFolder(accessToken);
    const existing = await findFile(accessToken, folderId);

    // Merge new research into existing cache
    const cache = existing?.content || { accounts: {}, lastUpdated: null };
    cache.accounts[accountId] = {
      ...researchData,
      cachedAt: new Date().toISOString(),
    };
    cache.lastUpdated = new Date().toISOString();
    cache.totalAccounts = Object.keys(cache.accounts).length;

    const fileContent = JSON.stringify(cache, null, 2);

    if (existing?.id) {
      // Update existing file
      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: fileContent,
        }
      );
    } else {
      // Create new file with multipart upload
      const boundary = "accelerate_boundary";
      const metadata = JSON.stringify({
        name: FILE_NAME,
        mimeType: "application/json",
        parents: [folderId],
      });

      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${fileContent}\r\n--${boundary}--`;

      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      );
    }

    return NextResponse.json({
      saved: true,
      accountId,
      totalCached: Object.keys(cache.accounts).length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
