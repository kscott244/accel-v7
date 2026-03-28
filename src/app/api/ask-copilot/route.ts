import { NextRequest, NextResponse } from "next/server";

// ── Intent parser prompt ──────────────────────────────────────────
// The LLM's only job is to parse the user's question into a structured
// command. It never sees actual account data and never invents numbers.
// All data retrieval runs client-side against the real loaded dataset.

const SYSTEM = `You are an intent parser for a dental sales territory app. 
Parse the user's question into a JSON command. Return ONLY valid JSON, no explanation.

Command types and their fields:

1. RANK — find top/bottom accounts by a metric
{"type":"rank","metric":"cy1|py1|gap|ret|last","dir":"desc|asc","limit":5,"product":"optional product name","qualifier":"buying|stopped|all"}

2. FILTER — find accounts matching product criteria  
{"type":"filter","buying":["prod1"],"notBuying":["prod2"],"limit":10,"minPY":0}

3. FOLLOW_UP — find accounts needing follow-up
{"type":"follow_up","reason":"dark|overdue_task|low_ret|stopped","limit":10}

4. OPPORTUNITY — find cross-sell / win-back opportunities
{"type":"opportunity","category":"xsell|winback|tier_upgrade|new_buyer","product":"optional","limit":10}

5. UNKNOWN — cannot parse
{"type":"unknown","reason":"brief explanation"}

Product name rules:
- Normalize to uppercase partial match (e.g. "simplishade" → "SIMPLISHADE", "maxcem" → "MAXCEM", "bond" → "OPTIBOND", "composite" → "HARMONIZE|SIMPLISHADE|SONICFILL")
- "bond" or "bonding agent" → "OPTIBOND"
- "composite" or "comp" → ["HARMONIZE","SIMPLISHADE","SONICFILL"]
- "cement" → "MAXCEM"
- "curing light" → "DEMI"
- Return product as a string or array of strings

Metric rules:
- "top buyer", "most", "highest spend" → metric:"cy1", dir:"desc"
- "most PY", "last year" → metric:"py1", dir:"desc"  
- "biggest gap", "down the most", "most behind" → metric:"gap", dir:"desc"
- "haven't ordered", "gone dark", "not buying" → type:"follow_up", reason:"dark"
- "follow up", "this week", "overdue" → type:"follow_up"
- "buy X but not Y" → type:"filter"
- "opportunity", "white space", "not buying" → type:"opportunity"

Examples:
"who's my number one simplishade user" → {"type":"rank","metric":"cy1","dir":"desc","limit":5,"product":"SIMPLISHADE","qualifier":"buying"}
"what aspen office is down the most" → {"type":"rank","metric":"gap","dir":"desc","limit":5,"qualifier":"all"}
"which accounts buy bond but not composite" → {"type":"filter","buying":["OPTIBOND"],"notBuying":["HARMONIZE","SIMPLISHADE","SONICFILL"],"limit":10}
"who should I follow up with this week" → {"type":"follow_up","reason":"dark","limit":10}
"best maxcem opportunity" → {"type":"opportunity","category":"winback","product":"MAXCEM","limit":10}`;

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question?.trim()) return NextResponse.json({ error: "No question" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.replace(/\s/g, ""),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: SYSTEM,
        messages: [{ role: "user", content: question.trim() }],
      }),
    });

    const data = await response.json();
    const raw = data?.content?.[0]?.text || "";

    let command: any;
    try {
      // Strip any markdown fences
      const cleaned = raw.replace(/```json|```/g, "").trim();
      command = JSON.parse(cleaned);
    } catch {
      command = { type: "unknown", reason: "Could not parse intent. Try rephrasing." };
    }

    return NextResponse.json({ command });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
