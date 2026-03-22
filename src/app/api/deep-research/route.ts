import { NextRequest, NextResponse } from "next/server";

// Contact tier definitions — determines hierarchy position in the contact card
// Tier 1 = most important decision maker, Tier 5 = front line staff
const CONTACT_TIERS: Record<string, number> = {
  // Tier 1 — Owner/CEO/Primary Doctor
  "owner": 1, "ceo": 1, "chief executive": 1, "founder": 1, "president": 1,
  "doctor": 1, "dds": 1, "dmd": 1, "periodontist": 1, "orthodontist": 1,
  "oral surgeon": 1, "endodontist": 1, "prosthodontist": 1, "pediatric dentist": 1,
  // Tier 2 — Associate Doctors / Practice Manager
  "associate": 2, "associate doctor": 2, "associate dentist": 2,
  "practice manager": 2, "office manager": 2, "clinic manager": 2,
  // Tier 3 — Regional/Operations leadership (DSO)
  "regional manager": 3, "regional director": 3, "director of operations": 3,
  "operations manager": 3, "general manager": 3, "area manager": 3,
  // Tier 4 — Treatment Coordinator / Front Office Lead
  "treatment coordinator": 4, "patient coordinator": 4, "front office manager": 4,
  "billing manager": 4, "scheduling coordinator": 4,
  // Tier 5 — Front line (usually not worth saving)
  "hygienist": 5, "dental assistant": 5, "front desk": 5, "receptionist": 5,
};

function getContactTier(role: string): number {
  const r = role.toLowerCase();
  for (const [key, tier] of Object.entries(CONTACT_TIERS)) {
    if (r.includes(key)) return tier;
  }
  return 3; // default mid-tier if unknown
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, city, state, address, dealer, products, doctor, gName, acctId, ownership } = body;

    if (!name) return NextResponse.json({ error: "No account name" }, { status: 400 });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

    const practiceLabel = gName && gName !== name ? `${name} (part of ${gName})` : name;
    const location = [address, city, state].filter(Boolean).join(", ");
    
    // Determine account type for contact hierarchy guidance
    const isDSO = ownership === "dso" || ownership === "emerging_dso";
    const accountType = isDSO ? "DSO/group practice" : "private practice";

    const systemPrompt = `You are a dental industry intelligence analyst helping a Kerr dental sales rep prepare for a sales call.
Your job is to research a dental practice and return structured, actionable intelligence.
Be concise and direct. Sales reps read this on a phone screen between calls.
Focus on things that help them sell and build relationships.
Always search the web before answering. If you cannot find specific information, say so briefly rather than guessing.`;

    const userPrompt = `Research this dental practice for a sales call:

Practice: ${practiceLabel}
Location: ${location}
Account type: ${accountType}
Distributor: ${dealer || "Unknown"}
${doctor ? `Known doctor: ${doctor}` : ""}
${products?.length ? `Currently buying: ${products.slice(0,5).join(", ")}` : ""}

Search the web and find:

1. PRACTICE STATUS — Still open? Recent changes — sold, acquired, moved, rebranded, expanded?

2. CONTACTS — Find the most important contacts for a dental sales rep. Focus on:
   - For PRIVATE PRACTICES: The owner/doctor (name + email if findable), office manager or practice manager
   - For DSOs/GROUP PRACTICES: Regional manager or director, practice manager, and the lead doctor if findable
   - Skip hygienists, assistants, and front desk unless they're named as a key contact
   - Maximum 4 contacts. Only include contacts you actually found, not guesses.

3. DSO / OWNERSHIP — Independent or group? Recent acquisition signs?

4. RELATIONSHIP HOOKS — New services, awards, CE courses, community involvement, recent reviews?

5. TALKING POINTS — 2-3 specific non-generic things Ken Scott (the rep) could mention when he walks in.

Return ONLY valid JSON with these exact keys:
{
  "status": "open|closed|unknown|changed",
  "statusNote": "one sentence",
  "website": "url or null",
  "phone": "number or null",
  "email": "primary email or null",
  "contactName": "primary contact name or null",
  "contacts": [
    {
      "name": "Full Name",
      "role": "exact title e.g. Practice Manager, Owner/DDS, Regional Director",
      "email": "email or null",
      "phone": "phone or null",
      "tier": 1
    }
  ],
  "ownership": "independent|dso|emerging_dso|unknown",
  "ownershipNote": "one sentence",
  "hooks": ["hook1", "hook2"],
  "competitive": "one sentence or null",
  "talkingPoints": ["point1", "point2", "point3"],
  "searchedAt": "${new Date().toISOString()}"
}

For the contacts array: tier 1=owner/primary doctor, tier 2=associate doctor/practice manager, tier 3=regional/ops manager, tier 4=coordinator/front office lead. Only include contacts you actually found with real names.
Return ONLY valid JSON, no markdown, no preamble.`;

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
        max_tokens: 2000,
        system: systemPrompt,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: `Anthropic ${response.status}: ${data?.error?.message}` }, { status: 502 });
    }

    const textBlocks = (data?.content || []).filter((b: any) => b.type === "text");
    const rawText = textBlocks.map((b: any) => b.text).join("").trim();
    const clean = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let intel: any = {};
    try {
      intel = JSON.parse(clean);

      // Enrich contacts with computed tier if not set
      if (intel.contacts?.length) {
        intel.contacts = intel.contacts
          .filter((c: any) => c.name && c.name !== "null")
          .map((c: any) => ({
            ...c,
            tier: c.tier || getContactTier(c.role || ""),
          }))
          .sort((a: any, b: any) => a.tier - b.tier)
          .slice(0, 4); // max 4 contacts
      }

      // Auto-save to patches.json if we have an account ID and found contacts
      const GITHUB_PAT = process.env.GITHUB_PAT;
      if (GITHUB_PAT && acctId && intel.contacts?.length) {
        try {
          // Fire and forget — don't block the response
          const baseUrl = req.nextUrl.origin;
          fetch(`${baseUrl}/api/save-patch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "contact_override",
              payload: {
                id: acctId,
                contactName: intel.contacts[0]?.name || intel.contactName || null,
                email: intel.contacts[0]?.email || intel.email || null,
                phone: intel.contacts[0]?.phone || intel.phone || null,
                contacts: intel.contacts,
                website: intel.website || null,
                note: `Auto-saved from Deep Research ${new Date().toLocaleDateString()}`,
              }
            })
          }).catch(() => {}); // silent fail — don't break research if save fails
        } catch {}
      }

    } catch {
      intel = { rawText, parseError: true };
    }

    return NextResponse.json({ intel });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
