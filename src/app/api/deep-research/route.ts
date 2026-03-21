import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, city, state, address, dealer, products, doctor, gName } = body;

    if (!name) return NextResponse.json({ error: "No account name" }, { status: 400 });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

    const practiceLabel = gName && gName !== name ? `${name} (part of ${gName})` : name;
    const location = [address, city, state].filter(Boolean).join(", ");

    const systemPrompt = `You are a dental industry intelligence analyst helping a Kerr dental sales rep prepare for a sales call.
Your job is to research a dental practice and return structured, actionable intelligence.
Be concise and direct. Sales reps read this on a phone screen between calls.
Focus on things that help them sell and build relationships — not generic dental industry facts.
Always search the web before answering. If you cannot find specific information, say so briefly rather than guessing.`;

    const userPrompt = `Research this dental practice for a sales call:

Practice: ${practiceLabel}
Location: ${location}
Distributor: ${dealer || "Unknown"}
${doctor ? `Doctor: ${doctor}` : ""}
${products?.length ? `Currently buying: ${products.slice(0,5).join(", ")}` : ""}

Search the web and find:

1. PRACTICE STATUS — Is this practice still open and operating? Any recent changes — sold, acquired by DSO, moved, rebranded, new ownership, expanded?

2. CONTACT INTEL — Website URL, phone number, contact email, office manager or front desk name if findable.

3. DSO / OWNERSHIP — Is this independently owned or part of a group? Any signs of recent acquisition or affiliation change? Many "private practices" have been quietly absorbed.

4. RELATIONSHIP HOOKS — What are they known for? Any new services added (implants, ortho, pediatric, sedation)? Recent reviews mentioning specific procedures? CE courses the doctor has taken? Awards? Community involvement? These are conversation openers.

5. COMPETITIVE SIGNALS — Any mentions of competitors (Dentsply, 3M, Ivoclar, DENTSPLY Sirona)? Any promotions or price sensitivity signals?

6. TALKING POINTS — Based on what you found, give 2-3 specific, non-generic things Ken Scott (the rep) could mention or ask about when he walks in.

Format your response as JSON with these keys:
{
  "status": "open|closed|unknown|changed",
  "statusNote": "one sentence on current status",
  "website": "url or null",
  "phone": "number or null", 
  "email": "email or null",
  "contactName": "name or null",
  "ownership": "independent|dso|emerging_dso|unknown",
  "ownershipNote": "one sentence",
  "hooks": ["hook1", "hook2"],
  "competitive": "one sentence or null",
  "talkingPoints": ["point1", "point2", "point3"],
  "searchedAt": "${new Date().toISOString()}"
}

Return ONLY valid JSON, no markdown, no preamble.`;

    // Call Claude with web_search tool enabled
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.replace(/\s/g, ""),
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        tools: [{
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 4,
        }],
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic deep research error:", response.status, JSON.stringify(data));
      return NextResponse.json({ error: `Anthropic ${response.status}: ${data?.error?.message || JSON.stringify(data)}` }, { status: 502 });
    }

    // Extract the final text block (after tool use blocks)
    const textBlocks = (data?.content || []).filter((b: any) => b.type === "text");
    const rawText = textBlocks.map((b: any) => b.text).join("").trim();

    // Parse JSON — strip any markdown fences if present
    const clean = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let intel: any = {};
    try {
      intel = JSON.parse(clean);
    } catch {
      // If JSON parse fails, return raw text wrapped
      intel = { rawText, parseError: true };
    }

    return NextResponse.json({ intel });
  } catch (e: any) {
    console.error("Deep research error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
