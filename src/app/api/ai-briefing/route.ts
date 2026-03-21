import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured on server" }, { status: 500 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", response.status, JSON.stringify(data));
      return NextResponse.json({ error: `Anthropic ${response.status}: ${data?.error?.message || JSON.stringify(data)}` }, { status: 502 });
    }

    const text = data?.content?.[0]?.text || "";
    return NextResponse.json({ text });
  } catch (e: any) {
    console.error("Route error:", e.message);
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}
