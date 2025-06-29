import { NextRequest, NextResponse } from "next/server";

// Strongly typed suggestion structure
interface AISuggestion {
  label: string;
  value: string;
}

interface AIResponse {
  choices: AISuggestion[];
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No Google API key set" }, { status: 500 });
  }

  // System prompt with explicit structure
  const geminiReqBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    system_instruction: {
      parts: [
        {
          text: 
`You are a helpful data cleaning assistant. When asked for suggestions, ALWAYS return a JSON object with a 'choices' key, whose value is an array of 1-3 objects. Each object must have a 'label' (string, for display) and a 'value' (string, to be used as the cell value). Example: { "choices": [ { "label": "value1", "value": "value1" }, { "label": "value2", "value": "value2" } ] }. Do not explain, do not return anything except this JSON object.

Special rule: If the field is 'AttributesJSON' and the value is vague, plain text, or not a valid JSON object, return a suggestion where 'label' is a pretty-printed JSON object (e.g. {"message": "the original value"}) and 'value' is the stringified version of that object.`
        }
      ]
    },
    generationConfig: {
      response_mime_type: "application/json",
    }
  };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(geminiReqBody),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Gemini API request failed:", errorBody);
    return NextResponse.json({ error: "Gemini API request failed", details: errorBody }, { status: res.status });
  }

  const data = await res.json();
  console.log(data);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let choices: AISuggestion[] = [];
  try {
    const parsed: AIResponse = JSON.parse(text);
    if (Array.isArray(parsed.choices)) {
      // Validate structure
      choices = parsed.choices.filter(
        (c: any) => typeof c.label === 'string' && typeof c.value === 'string'
      );
    }
  } catch (e) {
    console.error("Failed to parse JSON from Gemini response:", text, e);
    // fallback: try to extract JSON from text if it's not perfectly formatted
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed: AIResponse = JSON.parse(match[0]);
        if (Array.isArray(parsed.choices)) {
          choices = parsed.choices.filter(
            (c: any) => typeof c.label === 'string' && typeof c.value === 'string'
          );
        }
      } catch {}
    }
  }
  return NextResponse.json({ choices });
}