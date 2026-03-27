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
    const { name, childNames, city, state, address, addresses, dealer, products, doctor, gName, acctId, ownership, tier, score } = body;

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
Focus on things that help them sell and build relationships — real signals, not generic advice.
Always search the web before answering. If you cannot find specific information, say so briefly rather than guessing.
Prioritize recency: a practice that recently expanded, changed ownership, or added services is a hot opportunity.`;

    const userPrompt = `Research this dental practice for a sales call:

Practice / group name: ${practiceLabel}
${childNames?.length ? `Individual location names: ${(childNames as string[]).slice(0,6).join(", ")}` : ""}
Location: ${location}
${addresses?.length ? `Addresses: ${(addresses as string[]).join(" | ")}` : ""}
Account type: ${accountType}
Distributor: ${dealer || "All Other"}
${doctor ? `Known doctor: ${doctor}` : ""}
${products?.length ? `Currently buying: ${products.slice(0,5).join(", ")}` : ""}

IMPORTANT: The group name may be a distributor label, not the real practice name. Search the individual location names and addresses. Try each separately if needed.

Search the web and find:

1. PRACTICE STATUS — Still open? Any recent changes: sold, acquired, moved, rebranded, expanded, new locations?

2. CONTACTS — Find the most important contacts for a dental sales rep. Priority order:
   - For PRIVATE PRACTICES: Owner/doctor first (name + title + email if findable), then office manager or practice manager
   - For DSOs/GROUP PRACTICES: Regional director or ops manager first, then the lead/owner doctor if findable
   - Skip hygienists, assistants, and front desk unless they are named as a key decision-maker
   - Maximum 4 contacts. Only include contacts you actually found — no guesses.

3. DSO / OWNERSHIP — Independent, group, or DSO? Any acquisition signs? Who owns this practice?

4. COMPETITIVE INTEL — Does this practice mention other dental supply brands (Dentsply, 3M, Ivoclar, DENTSPLY Sirona, Envista, Ultradent, Hu-Friedy)? Any clues about who else is calling on them? Anything suggesting loyalty to a competitor or openness to switching? Mention specific brands if found.

5. CALL PREP — Give 3-4 highly specific, non-generic things Ken Scott (the Kerr rep) could say or ask when walking in. These should be things a rep could actually use in the first 60 seconds of a visit — not generic sales advice. Think: recent news the doc would care about, specific equipment or procedures they seem to use, a recognition or event worth mentioning, an expansion or new service that opens a Kerr product conversation. Each point should be a complete sentence Ken could reference.

Return ONLY valid JSON with these exact keys:
{
  "status": "open|closed|unknown|changed",
  "statusNote": "one sentence — include any recent change if status is changed",
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
  "competitive": "one sentence on competitive signals with specific brand names, or null if nothing found",
  "callPrep": ["specific prep point 1", "specific prep point 2", "specific prep point 3"],
  "hooks": ["hook1", "hook2"],
  "talkingPoints": ["point1", "point2", "point3"],
  "locations": [
    {"name": "Practice Name", "address": "123 Main St", "city": "City", "state": "ST", "zip": "00000"}
  ],
  "searchedAt": "${new Date().toISOString()}"
}

For the "callPrep" array: these are the MOST important things. Each should be a complete sentence Ken could actually use or reference. Prioritize recency and specificity. Generic points like "ask about their supply needs" are useless — skip them entirely.

For the "hooks" array: interesting signals about the practice — awards, community involvement, growth signs, recent reviews, CE courses the doctor is taking. These are lighter conversation starters.

For the "locations" array: List ALL physical locations you find for this practice/group — include name, address, city, state, zip for each. If only one location exists, still include it. Critical for multi-location groups.

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
        // Use Sonnet only for high-value accounts (Diamond/Platinum or score>=40)
        // Everything else uses Haiku — ~20x cheaper, sufficient for basic practice lookup
        model: (tier === "Diamond" || tier === "Platinum" || (score && score >= 40))
          ? "claude-sonnet-4-6"
          : "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: systemPrompt,
        // max_uses: 2 keeps cost low — enough for practice + contact lookup
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const errMsg: string = data?.error?.message || "";
      const errType: string = data?.error?.type || "";
      const httpStatus: number = response.status;
      // Detect quota / billing / usage-limit failures explicitly
      const isQuotaError =
        httpStatus === 429 ||
        errType === "rate_limit_error" ||
        errType === "overloaded_error" ||
        errMsg.toLowerCase().includes("usage limit") ||
        errMsg.toLowerCase().includes("credit balance") ||
        errMsg.toLowerCase().includes("billing") ||
        errMsg.toLowerCase().includes("quota") ||
        errMsg.toLowerCase().includes("usage_limit_reached");
      if (isQuotaError) {
        return NextResponse.json({
          error: "provider_quota",
          errorCode: "PROVIDER_QUOTA",
          userMessage: "Research is temporarily unavailable — the AI provider key has hit its usage limit. Add credits at console.anthropic.com, then retry.",
          httpStatus,
        }, { status: 503 });
      }
      // All other provider errors — structured, no raw message leak
      return NextResponse.json({
        error: "provider_error",
        errorCode: "PROVIDER_ERROR",
        userMessage: "Research is temporarily unavailable. The AI provider returned an error.",
        httpStatus,
      }, { status: 502 });
    }

    const textBlocks = (data?.content || []).filter((b: any) => b.type === "text");
    const rawText = textBlocks.map((b: any) => b.text).join("").trim();
    // Extract JSON robustly — Claude sometimes adds prose before/after fences
    let clean = rawText.trim();
    const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      clean = fenceMatch[1].trim();
    } else {
      const first = clean.indexOf("{");
      const last = clean.lastIndexOf("}");
      if (first !== -1 && last !== -1) clean = clean.slice(first, last + 1);
    }

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

      // Merge callPrep into talkingPoints — callPrep is the newer, higher-quality field.
      // Keep talkingPoints as fallback so old cached results still render correctly.
      if (intel.callPrep?.length) {
        intel.talkingPoints = intel.callPrep;
      }

      // Auto-save research results to overlays.json contacts so they persist
      const GITHUB_PAT = process.env.GITHUB_PAT;
      if (GITHUB_PAT && acctId && (intel.contacts?.length || intel.website)) {
        try {
          const baseUrl = req.nextUrl.origin;
          // Load current overlays, merge in new contact data, save back
          const loadRes = await fetch(`${baseUrl}/api/load-overlay`);
          if (loadRes.ok) {
            const currentOverlays = await loadRes.json();
            const existingContact = currentOverlays.contacts?.[acctId] || {};
            const mergedContact = {
              ...existingContact,
              contactName: intel.contacts?.[0]?.name || existingContact.contactName || null,
              email: intel.contacts?.[0]?.email || existingContact.email || null,
              phone: intel.contacts?.[0]?.phone || existingContact.phone || null,
              website: intel.website || existingContact.website || null,
              contacts: intel.contacts?.length ? intel.contacts : (existingContact.contacts || []),
              researchedAt: new Date().toISOString(),
              researchNote: `Auto-saved ${new Date().toLocaleDateString()}`,
            };
            const updatedOverlays = {
              ...currentOverlays,
              contacts: { ...(currentOverlays.contacts || {}), [acctId]: mergedContact },
              lastUpdated: new Date().toISOString(),
            };
            fetch(`${baseUrl}/api/save-overlay`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updatedOverlays),
            }).catch(() => {}); // fire and forget — don't block research response
          }
        } catch {} // silent fail — never block the research result
      }

    } catch {
      intel = { rawText, parseError: true };
    }

    return NextResponse.json({ intel });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
