import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { intel, acct, accounts } = body;
    // accounts = condensed list: [{id, name, city, st, address}]

    if (!intel || !acct || !accounts?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

    // Build a condensed account list (cap at 500 to stay within context)
    const accountList = accounts.slice(0, 500).map((a: any, i: number) =>
      `${i+1}. ID:${a.id} | "${a.name}" | ${a.city}, ${a.st}${a.address ? " | " + a.address : ""}`
    ).join("\n");

    const prompt = `You are a dental territory intelligence assistant. A sales rep has just run deep research on one of their accounts and received intelligence that suggests it may be part of a multi-location group. Your job is to identify which OTHER accounts in their territory are likely the same practice or same ownership group.

RESEARCHED ACCOUNT:
Name: ${acct.name}
Location: ${acct.city}, ${acct.st}${acct.address ? ", " + acct.address : ""}

RESEARCH INTEL:
${intel.ownershipNote ? "Ownership: " + intel.ownershipNote : ""}
${intel.hooks?.length ? "Key findings:\n" + intel.hooks.map((h: string) => "- " + h).join("\n") : ""}
${intel.statusNote ? "Status: " + intel.statusNote : ""}
${intel.talkingPoints?.length ? "Talking points:\n" + intel.talkingPoints.map((t: string) => "- " + t).join("\n") : ""}

TERRITORY ACCOUNTS (${accounts.length} total, showing up to 500):
${accountList}

TASK: Identify which accounts from the list above are likely the SAME PRACTICE or SAME OWNERSHIP GROUP as the researched account. Use ALL available signals:
- Shared practice name or partial name (e.g. "Atwill", "Conroy")
- Addresses mentioned in the research intel matching accounts in the list
- Cities mentioned in the research as locations of this group
- Doctor names from the intel matching account names

RULES:
- Only return accounts you are CONFIDENT belong to the same group
- Do NOT match on generic dental words like "dental", "associates", "care", "family"
- Do NOT match just because they are in the same city — the city must be specifically mentioned as a location of THIS group in the research
- A match requires at least ONE specific signal: shared name keyword, specific address, or explicit city mention for THIS group
- Return empty array if no confident matches found

Return ONLY valid JSON, no markdown:
{
  "matches": [
    {"id": "account_id", "reason": "one sentence explaining why this is a match"}
  ]
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.replace(/\s/g, ""),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: `Anthropic ${response.status}: ${data?.error?.message}` }, { status: 502 });
    }

    const text = (data?.content||[]).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let result: any = { matches: [] };
    try { result = JSON.parse(clean); } catch { result = { matches: [], parseError: true, raw: text }; }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
