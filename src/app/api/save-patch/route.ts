import { NextRequest, NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO = "kscott244/accel-v7";
const FILE_PATH = "src/data/patches.json";

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();
    if (!GITHUB_PAT) return NextResponse.json({ error: "No GitHub PAT configured" }, { status: 500 });

    // 1. Fetch current patches.json from GitHub
    const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      headers: { Authorization: `token ${GITHUB_PAT}`, "User-Agent": "accel-v7" }
    });
    const fileData = await getRes.json();
    const currentContent = JSON.parse(Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString());
    const fileSha = fileData.sha;

    // 2. Apply the patch action
    let updated = { ...currentContent };

    if (action === "create_group") {
      // Add or update a group_create entry
      const existing = updated.group_creates.findIndex((g: any) => g.id === payload.id);
      if (existing >= 0) {
        updated.group_creates[existing] = payload;
      } else {
        updated.group_creates.push(payload);
      }
    }
    else if (action === "delete_group") {
      updated.group_creates = updated.group_creates.filter((g: any) => g.id !== payload.id);
    }
    else if (action === "detach_account") {
      const existing = updated.group_detaches.findIndex((d: any) => d.childId === payload.childId);
      if (existing >= 0) {
        updated.group_detaches[existing] = payload;
      } else {
        updated.group_detaches.push(payload);
      }
    }
    else if (action === "remove_detach") {
      updated.group_detaches = updated.group_detaches.filter((d: any) => d.childId !== payload.childId);
    }
    else if (action === "name_override") {
      const existing = updated.name_overrides.findIndex((n: any) => n.id === payload.id);
      if (existing >= 0) {
        updated.name_overrides[existing] = payload;
      } else {
        updated.name_overrides.push(payload);
      }
    }
    else if (action === "remove_name_override") {
      updated.name_overrides = updated.name_overrides.filter((n: any) => n.id !== payload.id);
    }
    else if (action === "contact_override") {
      const existing = updated.contact_overrides.findIndex((c: any) => c.id === payload.id);
      if (existing >= 0) {
        updated.contact_overrides[existing] = payload;
      } else {
        updated.contact_overrides.push(payload);
      }
    }
    else if (action === "remove_contact") {
      updated.contact_overrides = updated.contact_overrides.filter((c: any) => c.id !== payload.id);
    }
    else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Update timestamp
    updated._lastUpdated = new Date().toISOString().split("T")[0];

    // 3. Commit updated patches.json back to GitHub
    const newContent = Buffer.from(JSON.stringify(updated, null, 2)).toString("base64");
    const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_PAT}`,
        "Content-Type": "application/json",
        "User-Agent": "accel-v7"
      },
      body: JSON.stringify({
        message: `patch: ${action} — ${payload.name || payload.childId || payload.id || "update"}`,
        content: newContent,
        sha: fileSha
      })
    });

    const putData = await putRes.json();
    if (!putRes.ok) {
      return NextResponse.json({ error: putData.message || "GitHub commit failed" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      commit: putData.commit?.sha?.slice(0, 10),
      patches: updated 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
