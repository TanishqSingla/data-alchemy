import Papa from "papaparse";
import * as XLSX from "xlsx";
import { EntityType } from "./types";

const requiredColumns: Record<EntityType, string[]> = {
  clients: ["ClientID", "ClientName", "PriorityLevel"],
  workers: [
    "WorkerID",
    "WorkerName",
    "Skills",
    "AvailableSlots",
    "MaxLoadPerPhase",
  ],
  tasks: ["TaskID", "TaskName", "Duration", "RequiredSkills", "MaxConcurrent"],
};

export function detectEntityType(columns: string[]): EntityType | null {
  if (columns.includes("ClientID")) return "clients";
  if (columns.includes("WorkerID")) return "workers";
  if (columns.includes("TaskID")) return "tasks";
  return null;
}

export async function parseFile(file: File): Promise<{ type: EntityType; rows: any[] }> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  let rows: any[] = [];
  if (ext === "csv") {
    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    rows = parsed.data as any[];
  } else if (ext === "xlsx" || ext === "xls") {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    rows = json as any[];
  } else {
    throw new Error("Unsupported file type");
  }

  const type = detectEntityType(Object.keys(rows[0] || {}));
  if (!type) throw new Error("Could not determine entity type from headers");

  const missing = requiredColumns[type].filter((col) => !Object.keys(rows[0]).includes(col));
  if (missing.length) {
    throw new Error(`Missing required column(s): ${missing.join(", ")}`);
  }

  return { type, rows };
} 