import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID!;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;

// ─── KERR PRODUCT INTELLIGENCE ───────────────────────────────────────────────
// Used to help the AI make ONE natural, relevant product mention per email.
// Covers: what the product does, legacy upgrade paths, and one key talking point.
const KERR_PRODUCT_INTEL = `
KERR PRODUCT LINES (for context only — use sparingly, one mention max per email):

ADHESIVES:
- OptiBond Solo Plus: Legacy total-etch adhesive. Still reliable but older workflow (etch + prime + bond = 3 steps). If a doctor hasn't ordered this year, they may have switched to a competitor's self-etch.
  → Upgrade to: OptiBond Universal 360. Works total-etch, self-etch, or selective-etch. Light-cure primary but has dark-cure mode so light is optional. Rated #1 preferred bonding agent by Dental Advisor 2025. Reduces post-op sensitivity vs total-etch-only systems. Simplifies workflow significantly.
- OptiBond Universal: Previous generation universal. Good but 360 is the current flagship.
- OptiBond FL: Gold standard total-etch. Still preferred by some for high-stress restorations.
- OptiBond eXTRa: Self-etch, simplified workflow.

COMPOSITES:
- Herculite XRV / Herculite Ultra: Classic microhybrid composites. Excellent esthetics, proven. Still very relevant.
- Herculite Ultra Flow: Flowable version. Used for base/liner or small Class V.
- Harmonize: Nano-optimized composite. Better polishability than Herculite. Natural chameleon effect.
- SimpliShade: ONE shade composite — matches 95%+ of cases without shade selection. Major time saver for posterior work. If a doctor is buying Harmonize or Herculite but not SimpliShade, worth mentioning.
- SimpliShade Bulk Flow: Bulk-fill flowable version of SimpliShade. One shade, one increment, no capping layer needed.
- SonicFill 3: Sonic-activated bulk fill. Thins on activation for better adaptation. 4mm increments. Popular for posterior efficiency. If buying composites but not SonicFill, natural cross-sell.
- Premise / Premise Flowable: Nano-filled. Good esthetics, especially anterior.
- Point 4: Condensable nano-hybrid. Dense, predictable.
- Revolution 2: Flowable. Reliable, widely used.
- Flow-It ALC: Self-leveling flowable with auto-layer-curing. Good for deep margins.
- Demi Plus: Bulk-fill hybrid. Simple posterior workflow.
- Mojo: Universal nano-hybrid. Newer addition.

CEMENTS:
- TempBond / TempBond NE / TempBond Clear: Temporary cements. NE = non-eugenol (won't inhibit resin cure). Clear for esthetic temp coverage.
- MaxCem Elite: Self-adhesive resin cement. Simple: clean, apply, cure. No separate bonding step. Fluoride releasing.
- MaxCem Elite Chroma: Same as MaxCem Elite but color-changes from pink to tooth-colored on cure so you know it's set.
- NX3 Nexus: Multi-mode resin cement. Premium option. More technique-sensitive but greater control.
- Nexus RMGI: Resin-modified glass ionomer cement. Good for metal and PFM crowns where adhesive bonding isn't needed.
- Breeze: Self-adhesive cement. Moisture-tolerant.

INFECTION CONTROL:
- CaviWipes / CaviWipes XL / CaviWipes 2.0 / CaviWipes1 / CaviWipes HP: Surface disinfectant wipes. Every practice needs these. If buying older versions, worth mentioning 2.0 or HP for faster kill time.
- CaviCide / CaviCide1: Spray disinfectant. 1 = 1-minute contact time vs standard 3 min.
- Empower / Empower Foam: Ultrasonic cleaning solution. If buying Empower, Foam version may suit their workflow better.

MISC:
- Gel Etchant: Phosphoric acid gel for total-etch. Goes with OptiBond FL/Solo Plus.
- Bond-1: Simplified one-bottle bond system.
- Simile: CAD/CAM composite blocks.
`;

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
  const talkingPoints = account.talkingPoints?.slice(0,2).join("; ") || "";
  const hooks = account.hooks?.slice(0,1).join("; ") || "";

  const prompt = `You are Ken Scott, a Kerr Dental territory sales rep in Connecticut (CT/MA/RI/NY).
You're writing a SHORT personal email to a dental office that is down in purchases vs last year.
This comes from your personal Gmail — it should sound like a real person, not a marketing blast.

ACCOUNT:
- Office: ${account.name}, ${account.city} ${account.state || account.st || "CT"}
- Distributor: ${dealer} (reference ONLY this distributor)
- Tier: ${tier}
- Gap vs last year: $${gapDollars.toLocaleString()} down
- Products currently buying: ${products || "various Kerr products"}
${stoppedProducts ? `- Products they STOPPED buying this year: ${stoppedProducts}` : ""}
${talkingPoints ? `- Practice intel (from research): ${talkingPoints}` : ""}
${hooks ? `- Relationship hook: ${hooks}` : ""}
- Days left in Q1: 9

PRODUCT KNOWLEDGE (use to inform ONE natural product mention if relevant — do not recite this):
${KERR_PRODUCT_INTEL}

EMAIL RULES:
1. Start with: "${greeting},"
2. 4-6 sentences MAX. Be genuine, not scripted.
3. If a stopped product has a clear upgrade path (e.g. Solo Plus → Universal 360), mention the upgrade ONCE, naturally, as a helpful heads-up — not a pitch. Frame it as "a lot of practices have been making the switch" or "worth a quick conversation."
4. If practice intel or a relationship hook exists, weave ONE of those in naturally.
5. Reference end of Q1 / March 31st once — not as pressure, as a helpful timing note.
6. Reference ONLY ${dealer} as the distributor. Never name a competitor distributor or a rep by name.
7. Sign off: Ken Scott | Kerr Dental | 860-417-4071
8. Subject line: casual, specific to their products or situation. NOT generic.

Return ONLY valid JSON: {"subject": "...", "body": "..."}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
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
      body: `${greeting},\n\nJust wanted to reach out as we wrap up Q1. I noticed your account through ${dealer} is running a bit behind compared to last year and wanted to see if there's anything I can help with before March 31st.\n\nKen Scott | Kerr Dental | 860-417-4071`,
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
