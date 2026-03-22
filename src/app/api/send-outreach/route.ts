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
  if (!data.access_token) throw new Error("Failed to refresh token: " + JSON.stringify(data));
  return data.access_token;
}

async function generateEmail(account: any): Promise<{ subject: string; body: string }> {
  const gapDollars = Math.abs(account.gap || 0);
  const gapPct = account.gapPct ? Math.abs(account.gapPct) : 0;
  const tier = account.tier || "Standard";
  const products = account.topSkus?.map((s: any) => s.desc).filter(Boolean).join(", ") || "";
  const stoppedProducts = account.stoppedSkus?.map((s: any) => s.desc).filter(Boolean).join(", ") || "";
  const daysLeft = 10; // Q1 ends March 31

  const prompt = `You are Ken Scott, a Kerr Dental territory sales rep based in Connecticut covering CT/MA/RI/NY. 
You're writing a SHORT, personal email to a dental office that is down in purchases compared to last year.
This is from your PERSONAL Gmail so it should feel like a real person wrote it, not a marketing blast.

Account details:
- Office: ${account.name}
- City: ${account.city}, ${account.state}  
- Distributor: ${account.dealer}
- Account tier: ${tier}
- Q1 gap vs last year: $${gapDollars.toLocaleString()} (${gapPct.toFixed(0)}% down)
- Products they've been buying: ${products || "various Kerr products"}
${stoppedProducts ? `- Products they stopped buying: ${stoppedProducts}` : ""}
- Days left in Q1: ${daysLeft}

Write a GENUINE, SHORT email (4-6 sentences max). Rules:
- Sound like a real person, not a sales robot
- Reference something specific about their account (gap, products, or tier if relevant)  
- Don't be pushy or aggressive — be helpful
- Mention Q1 promos or end of quarter savings naturally if it fits
- Sign off as: Ken Scott | Kerr Dental | 860-417-4071
- Subject line should be casual and personal, NOT generic like "Checking In"

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
      body: `Hi there,\n\nJust wanted to reach out personally as we wrap up Q1. I noticed your account is running a bit behind compared to last year and wanted to see if there's anything I can help with — whether it's timing an order before quarter end or talking through what's working for other practices in the area.\n\nLet me know if you have a few minutes to connect.\n\nKen Scott | Kerr Dental | 860-417-4071`,
    };
  }
}

async function sendGmail(accessToken: string, to: string, subject: string, body: string): Promise<void> {
  const fromName = "Ken Scott - Kerr Dental";
  const message = [
    `From: ${fromName} <me>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join("\n");

  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
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

    if (!accounts?.length) return NextResponse.json({ error: "No accounts provided" }, { status: 400 });
    if (!refreshToken && !preview) return NextResponse.json({ error: "No Gmail token" }, { status: 401 });

    // Get fresh access token
    let accessToken = "";
    if (!preview) {
      accessToken = await refreshAccessToken(refreshToken);
    }

    const results = [];

    for (const account of accounts) {
      try {
        // Generate personalized email via Claude
        const { subject, body } = await generateEmail(account);

        if (preview) {
          // Just return the draft without sending
          results.push({ id: account.id, name: account.name, email: account.email, subject, body, status: "preview" });
        } else {
          if (!account.email) {
            results.push({ id: account.id, name: account.name, status: "skipped", reason: "no email" });
            continue;
          }
          // Actually send
          await sendGmail(accessToken, account.email, subject, body);
          results.push({ id: account.id, name: account.name, email: account.email, subject, status: "sent" });
          // Small delay to avoid rate limiting
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
