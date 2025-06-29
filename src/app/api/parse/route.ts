import { NextRequest, NextResponse } from "next/server";
import { parseFile } from "@/lib/parse";
import { schemas } from "@/lib/schema";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const { type, rows } = await parseFile(file);

    // schema-level validation
    const errors: any[] = [];
    const schema = schemas[type];
    rows.forEach((row: any, i: number) => {
      const res = schema.safeParse(row);
      if (!res.success) {
        res.error.errors.forEach((e) =>
          errors.push({ rowIndex: i, field: e.path.join("."), message: e.message })
        );
      }
    });

    return NextResponse.json({ type, rows, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Parse failed" }, { status: 400 });
  }
} 