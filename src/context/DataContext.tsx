"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Dataset, EntityType } from "../lib/types";
import { schemas } from "../lib/schema";

export interface ValidationError {
  entity: EntityType;
  rowIndex: number;
  field: string;
  message: string;
}

interface DataContextValue {
  data: Dataset;
  setEntityRows: (type: EntityType, rows: any[] | ((prev: any[]) => any[])) => void;
  errors: ValidationError[];
  validateAll: () => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

const emptyData: Dataset = { clients: [], workers: [], tasks: [] };

async function aiFixRow(row) {
  const prompt = `You are a data cleaning assistant. Fix this row: ${JSON.stringify(row)}`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer YOUR_OPENAI_API_KEY" // Never expose this in production!
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    })
  });
  const data = await response.json();
  // Parse the AI's response as JSON
  const fixedRow = JSON.parse(data.choices[0].message.content);
  return fixedRow;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset>(emptyData);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const setEntityRows = (type: EntityType, rowsOrUpdater: any[] | ((prev: any[]) => any[])) => {
    setData((prev) => {
      const newRows = typeof rowsOrUpdater === "function" ? (rowsOrUpdater as any)(prev[type]) : rowsOrUpdater;
      return { ...prev, [type]: newRows };
    });
  };

  const validateAll = () => {
    const newErrors: ValidationError[] = [];

    (Object.keys(data) as EntityType[]).forEach((type) => {
      const schema = schemas[type];
      data[type].forEach((row: any, i: number) => {
        const res = schema.safeParse(row);
        if (!res.success) {
          res.error.errors.forEach((e) => {
            newErrors.push({
              entity: type,
              rowIndex: i,
              field: e.path.join("."),
              message: e.message,
            });
          });
        }
      });
    });

    // Custom validations
    // 1. Duplicate IDs
    const idSets: Record<EntityType, Record<string, number[]>> = {
      clients: {},
      workers: {},
      tasks: {},
    };

    (Object.keys(data) as EntityType[]).forEach((type) => {
      const idKey = type === "clients" ? "ClientID" : type === "workers" ? "WorkerID" : "TaskID";
      data[type].forEach((row: any, i: number) => {
        const idVal = row[idKey];
        if (!idVal) return;
        idSets[type][idVal] = idSets[type][idVal] ? [...idSets[type][idVal], i] : [i];
      });
    });

    (Object.keys(idSets) as EntityType[]).forEach((type) => {
      const idKey = type === "clients" ? "ClientID" : type === "workers" ? "WorkerID" : "TaskID";
      Object.entries(idSets[type]).forEach(([id, rowsIdx]) => {
        if (rowsIdx.length > 1) {
          rowsIdx.forEach((rIdx) =>
            newErrors.push({
              entity: type,
              rowIndex: rIdx,
              field: idKey,
              message: `Duplicate ${idKey}`,
            })
          );
        }
      });
    });

    // 2. Broken JSON in AttributesJSON (only if value looks like JSON)
    data.clients.forEach((row: any, i: number) => {
      const val = row.AttributesJSON;
      if (typeof val !== "string" || val.trim() === "") return;
      try {
        JSON.parse(val);
      } catch {
        newErrors.push({
          entity: "clients",
          rowIndex: i,
          field: "AttributesJSON",
          message: "Invalid JSON",
        });
      }
    });

    // 3. Malformed lists & Overloaded workers
    data.workers.forEach((row: any, i) => {
      const slotsStr = row.AvailableSlots as string;
      let numbers: number[] = [];
      if (slotsStr) {
        try {
          if (slotsStr.trim().startsWith("[")) {
            numbers = JSON.parse(slotsStr);
          } else {
            numbers = slotsStr.split(/[,;]/).map((s: string) => Number(s.trim())).filter(Boolean);
          }
          if (!Array.isArray(numbers) || numbers.some((n) => isNaN(n))) {
            throw new Error();
          }
        } catch {
          newErrors.push({
            entity: "workers",
            rowIndex: i,
            field: "AvailableSlots",
            message: "Malformed list",
          });
        }
      }

      // Overloaded workers
      const maxLoad = Number(row.MaxLoadPerPhase ?? 0);
      if (numbers.length && maxLoad && numbers.length < maxLoad) {
        newErrors.push({
          entity: "workers",
          rowIndex: i,
          field: "MaxLoadPerPhase",
          message: "Load exceeds available slots",
        });
      }
    });

    const taskIds = new Set(data.tasks.map((t: any) => t.TaskID));
    data.clients.forEach((row: any, i) => {
      const listStr = row.RequestedTaskIDs as string;
      if (!listStr) return;
      const ids = listStr.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
      ids.forEach((id) => {
        if (!taskIds.has(id)) {
          newErrors.push({
            entity: "clients",
            rowIndex: i,
            field: "RequestedTaskIDs",
            message: `Unknown TaskID '${id}'`,
          });
        }
      });
    });

    setErrors(newErrors);
  };

  useEffect(() => {
    validateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const value: DataContextValue = { data, setEntityRows, errors, validateAll };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
} 