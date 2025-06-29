import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No OpenAI API key set" }, { status: 500 });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful data cleaning assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  let rows = [];
  try {
    rows = JSON.parse(text);
  } catch {
    // fallback: try to extract JSON from text
    const match = text.match(/\[([\s\S]*)\]|\{([\s\S]*)\}/);
    if (match) {
      try { rows = JSON.parse(match[0]); } catch {}
    }
  }
  return NextResponse.json({ rows });
} 