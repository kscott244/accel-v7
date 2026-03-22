import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID!;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to refresh token");
  return data.access_token;
}

async function generateEmail(account: any): Promise<{ subject: string; body: string }> {
  const dealer = account.primaryDealer || account.dealer || "your distributor";
  const doctorName = account.doctor || null;
  const greeting = doctorName ? `Hi ${doctorName}` : "Hi there";
  const gapDollars = Math.abs(account.combinedGap || account.gap || 0);
  const tier = account.tier || "Standard";
  const products = account.topSkus?.map((s: any) => s.desc).filter(Boolean).join(", ") || "";
  const stoppedProducts = account.stoppedSkus?.map((s: any) => s.desc).filter(Boolean).join(", ") || "";

  // Deep research intel if available
  const talkingPoints = account.talkingPoints?.slice(0,2).join("; ") || "";
  const hooks = account.hooks?.slice(0,2).join("; ") || "";
  const ownershipNote = account.ownershipNote || "";

  const prompt = `You are Ken Scott, a Kerr Dental territory sales rep based in Connecticut covering CT/MA/RI/NY.
You're writing a SHORT, personal email to a dental office that is down in purchases vs last year.
This is from your PERSONAL Gmail so it should feel like a real person wrote it, not a marketing blast.

Account details:
- Office: ${account.name}
- City: ${account.city}, ${account.state || account.st || "CT"}
- Primary distributor for this gap: ${dealer}
- Account tier: ${tier}
- Gap vs last year: $${gapDollars.toLocaleString()} down
- Products they've been buying: ${products || "various Kerr products"}
${stoppedProducts ? `- Products they stopped buying: ${stoppedProducts}` : ""}
${talkingPoints ? `- Specific talking points from research: ${talkingPoints}` : ""}
${hooks ? `- Relationship hooks found: ${hooks}` : ""}
${ownershipNote ? `- Practice context: ${ownershipNote}` : ""}
- Days left in Q1: 9

Write a GENUINE, SHORT email (4-6 sentences max). Rules:
- Start with: "${greeting},"
- If talking points or hooks are provided, weave ONE naturally into the email — make it feel like you know them
- Reference the SPECIFIC distributor (${dealer}) naturally
- Reference specific products they buy by name if available
- Do NOT mention any other distributor
- Do NOT mention any distributor rep by name
- Sound like a real person, not a sales robot
- Mention end of Q1 / March 31st deadline naturally
- Sign off as: Ken Scott | Kerr Dental | 860-417-4071
- Subject line should be casual and specific, NOT generic

Return ONLY a JSON object like:
{"subject": "...", "body": "..."}
No markdown, no preamble.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return {
      subject: `Quick note from Ken — Kerr Dental`,
      body: `${greeting},\n\nJust wanted to reach out as we wrap up Q1. I noticed your account through ${dealer} is running behind compared to last year and wanted to see if there's anything I can help with before March 31st.\n\nKen Scott | Kerr Dental | 860-417-4071`,
    };
  }
}

async function sendGmail(accessToken: string, to: string, subject: string, body: string): Promise<void> {
  const message = [`To: ${to}`, `Subject: ${subject}`, `Content-Type: text/plain; charset=utf-8`, ``, body].join("\n");
  const encoded = Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Gmail send failed: ${JSON.stringify(err)}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { accounts, refreshToken, preview } = await req.json();
    if (!accounts?.length) return NextResponse.json({ error: "No accounts" }, { status: 400 });
    if (!refreshToken && !preview) return NextResponse.json({ error: "No Gmail token" }, { status: 401 });

    let accessToken = "";
    if (!preview) accessToken = await refreshAccessToken(refreshToken);

    const results = [];
    for (const account of accounts) {
      try {
        const { subject, body } = await generateEmail(account);
        if (preview) {
          results.push({ id: account.id, name: account.name, email: account.email, subject, body, status: "preview" });
        } else {
          if (!account.email) {
            results.push({ id: account.id, name: account.name, status: "skipped", reason: "no email" });
            continue;
          }
          await sendGmail(accessToken, account.email, subject, body);
          results.push({ id: account.id, name: account.name, email: account.email, subject, status: "sent" });
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (err: any) {
        results.push({ id: account.id, name: account.name, status: "error", reason: err.message });
      }
    }
    return NextResponse.json({ results, sent: results.filter(r => r.status === "sent").length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
