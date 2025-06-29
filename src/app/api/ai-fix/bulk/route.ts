import { NextRequest, NextResponse } from "next/server";

interface BulkAIFixRequest {
  entity: string;
  rows: any[];
  errors: { rowIndex: number; field: string; message: string }[];
}

export async function POST(req: NextRequest) {
  const { entity, rows, errors }: BulkAIFixRequest = await req.json();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No Google API key set" }, { status: 500 });
  }

  const prompt = `You are a data cleaning assistant. Your job is to fix errors in a ${entity} table.\n\nHere is the table data (as JSON array):\n${JSON.stringify(rows, null, 2)}\n\nHere are the validation errors (with row numbers and fields):\n${JSON.stringify(errors, null, 2)}\n\nFor each row with errors, suggest a corrected version.\n- If a value is missing, fill it with a plausible guess.\n- If a value is malformed (e.g. not a number, invalid JSON), fix the format.\n- If an ID is duplicated, make it unique by appending a suffix.\n- If a reference is unknown, try to match it to the closest valid value or remove it.\n- If a value is out of range, bring it into the valid range.\n- If a JSON field is broken, repair the JSON.\n\nReturn ONLY the corrected table as a JSON array, with the same number of rows and columns as the input.`;

  const geminiReqBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    system_instruction: {
      parts: [
        {
          text: `You are a helpful data cleaning assistant. When asked for a bulk fix, ALWAYS return a JSON array of rows, with the same number of rows and columns as the input. Do not explain, do not return anything except this JSON array.`
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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let fixedRows: any[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      fixedRows = parsed;
    }
  } catch (e) {
    console.error("Failed to parse JSON from Gemini response:", text, e);
    // fallback: try to extract JSON array from text
    const match = text.match(/\[([\s\S]*)\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          fixedRows = parsed;
        }
      } catch {}
    }
  }
  return NextResponse.json({ rows: fixedRows });
} 