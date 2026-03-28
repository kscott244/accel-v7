import { NextRequest, NextResponse } from "next/server";

// Full product catalog with family mappings — grounded in actual territory data
const SYSTEM = `You are an intent parser for Ken Scott's Kerr Dental territory sales app.
Ken covers CT, MA, RI, and parts of NY. He sells through Schein, Patterson, Benco, Darby.

Parse the user's question into a JSON command. Return ONLY valid JSON, no markdown, no explanation.

=== PRODUCT CATALOG (exact names in the data) ===
COMPOSITES: SIMPLISHADE, SIMPLISHADE BULK, SIMPLISHADE BULK FLOW, SIMPLISHADE SELF-ADHESIVE, HARMONIZE, SONICFILL, SONICFILL 3, HERCULITE ULTRA, HERCULITE ULTRA FLOW, HERCULITE XRV, POINT 4, PREMISE, PREMISE FLOWABLE, FLOW-IT ALC
BONDS: OPTIBOND FL, OPTIBOND SOLO PLUS, OPTIBOND UNIVERSAL, OPTIBOND UNIVERSAL 360, OPTIBOND eXTRa, BOND-1, BOND-1 SF
CEMENTS: MAXCEM ELITE, MAXCEM ELITE CHROMA, NX3, NEXUS RMGI, SIMILE, CEMENT IT
INFECTION CONTROL: CAVIWIPES, CAVIWIPES 2.0, CAVIWIPES HP, CAVIWIPES XL, CAVIWIPES1, CAVICIDE, CAVICIDE HP, CAVICIDE1
CURING LIGHTS: DEMI PLUS
TEMP CEMENT: TEMPBOND, TEMPBOND CLEAR, TEMPBOND NE
RMGI: BREEZE, BREEZE RMGI, NEXUS RMGI
DESENSITIZERS: EMPOWER, EMPOWER FOAM
OTHER: MOJO, GEL ETCHANT, REVOLUTION 2, VERTISE FLOW, ACCESSORIES

=== SYNONYM RULES ===
- "composite" / "comp" / "bulk fill" / "nano" → family:"COMPOSITE"
- "bond" / "bonding" / "adhesive" / "optibond" → family:"BOND"
- "cement" / "maxcem" / "resin cement" → family:"CEMENT"
- "wipes" / "caviwipes" / "infection control" / "cavicide" → family:"INFECTION_CONTROL"
- "curing light" / "light cure" / "demi" → product:"DEMI PLUS"
- "temp cement" / "temporary" / "tempbond" → family:"TEMP_CEMENT"
- "rmgi" / "glass ionomer" / "breeze" → family:"RMGI"
- "desensitizer" / "empower" → family:"DESENSITIZER"
- Exact product name → product:"EXACT NAME"

=== GEOGRAPHY ===
States: CT, NY, RI, MA
Cities: Stamford, Hartford, Bridgeport, Waterbury, Norwalk, Danbury, New Haven, Providence, Cranston, Warwick, White Plains, Yonkers, Scarsdale, New Rochelle, West Hartford, Manchester, Fairfield, Middletown, Hamden, Monroe, and 400+ others

=== ACCOUNT TYPES (class2 field) ===
- "dso" / "dso account" → accountType:"DSO"
- "emerging dso" / "small dso" → accountType:"EMERGING DSO"
- "community health" / "fqhc" / "clinic" → accountType:"COMMUNITY HEALTHCARE"
- "government" / "va" / "military" → accountType:"GOVERNMENT"
- "school" / "dental school" → accountType:"SCHOOLS"
- default (private practice) → accountType:"STANDARD"

=== TIERS ===
- "diamond" → tier:"Diamond"
- "platinum" → tier:"Platinum"
- "gold" → tier:"Gold"
- "silver" → tier:"Silver"
- "standard" / "no tier" / "not on accelerate" → tier:"Standard"
- "top 100" → tier:"Top100"

=== DEALERS ===
- "schein" / "henry schein" → dealer:"Schein"
- "patterson" → dealer:"Patterson"
- "benco" → dealer:"Benco"
- "darby" → dealer:"Darby"

=== COMMAND SCHEMA ===

1. RANK — top/bottom accounts by a metric, with optional filters
{
  "type": "rank",
  "metric": "cy1|py1|gap|ret|last|prodWidth",
  "dir": "desc|asc",
  "limit": 5,
  "product": "exact product name or null",
  "family": "COMPOSITE|BOND|CEMENT|INFECTION_CONTROL|TEMP_CEMENT|RMGI|DESENSITIZER|CURING_LIGHT or null",
  "qualifier": "buying|stopped|all",
  "state": "CT|NY|RI|MA or null",
  "city": "city name or null",
  "dealer": "Schein|Patterson|Benco|Darby or null",
  "tier": "Diamond|Platinum|Gold|Silver|Standard|Top100 or null",
  "accountType": "DSO|EMERGING DSO|COMMUNITY HEALTHCARE|GOVERNMENT|SCHOOLS|STANDARD or null"
}

2. FILTER — accounts matching product/geography/type criteria
{
  "type": "filter",
  "buying": ["family or product"],
  "notBuying": ["family or product"],
  "state": "CT|NY|RI|MA or null",
  "city": "city name or null",
  "dealer": "dealer or null",
  "tier": "tier or null",
  "accountType": "type or null",
  "minPY": 0,
  "limit": 10
}

3. FOLLOW_UP — accounts needing contact
{
  "type": "follow_up",
  "reason": "dark|low_ret|stopped|overdue",
  "minDays": 90,
  "state": "state or null",
  "dealer": "dealer or null",
  "limit": 10
}

4. OPPORTUNITY — growth/cross-sell/win-back
{
  "type": "opportunity",
  "category": "winback|xsell|tier_upgrade|growing",
  "product": "exact product or null",
  "family": "product family or null",
  "state": "state or null",
  "accountType": "type or null",
  "limit": 10
}

5. SUMMARY — aggregate answer (territory-level number or count)
{
  "type": "summary",
  "question": "what is the total cy spend on [product/family]?|how many accounts buy [x]?|how many accounts are [condition]?",
  "product": "product or null",
  "family": "family or null",
  "state": "state or null",
  "accountType": "type or null"
}

6. UNKNOWN
{"type": "unknown", "reason": "brief explanation"}

=== EXAMPLES ===
"who's buying the most composite?" → {"type":"rank","metric":"cy1","dir":"desc","limit":5,"family":"COMPOSITE","qualifier":"buying"}
"which Hartford accounts stopped buying bond?" → {"type":"rank","metric":"py1","dir":"desc","limit":10,"family":"BOND","qualifier":"stopped","city":"Hartford"}
"DSOs in CT with the biggest gap" → {"type":"rank","metric":"gap","dir":"desc","limit":8,"state":"CT","accountType":"DSO"}
"which accounts buy optibond but not any composite" → {"type":"filter","buying":["BOND"],"notBuying":["COMPOSITE"],"limit":10}
"my schein accounts in RI that are down" → {"type":"rank","metric":"gap","dir":"desc","limit":10,"dealer":"Schein","state":"RI"}
"how much caviwipes am I doing this year" → {"type":"summary","question":"total cy spend","family":"INFECTION_CONTROL"}
"which accounts only buy one product" → {"type":"rank","metric":"prodWidth","dir":"asc","limit":10,"qualifier":"all"}
"who in CT hasn't ordered in 90 days" → {"type":"follow_up","reason":"dark","minDays":90,"state":"CT","limit":10}
"platinum accounts with a gap" → {"type":"rank","metric":"gap","dir":"desc","limit":8,"tier":"Platinum"}
"fastest growing accounts" → {"type":"opportunity","category":"growing","limit":10}
"who should I call this week" → {"type":"follow_up","reason":"dark","minDays":60,"limit":10}`;

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
        max_tokens: 300,
        system: SYSTEM,
        messages: [{ role: "user", content: question.trim() }],
      }),
    });

    const data = await response.json();
    const raw = data?.content?.[0]?.text || "";
    let command: any;
    try {
      command = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      command = { type: "unknown", reason: "Could not parse intent. Try rephrasing." };
    }
    return NextResponse.json({ command });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
