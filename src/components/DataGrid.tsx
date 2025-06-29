"use client";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import { useData } from "../context/DataContext";
import { EntityType } from "../lib/types";
import { useMemo, useState } from "react";
import { exportToCSV, exportToXLSX } from "@/lib/export";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buildAutoFixPrompt } from "@/lib/aiPrompts";
import React from "react";
import { X } from 'lucide-react'

interface Props {
  type: EntityType;
}

// Define the suggestion type
interface AISuggestion {
  label: string;
  value: string;
}

// Separate cell component to avoid losing focus on re-renders
const InputCell = React.memo(function InputCell({ rowIndex, columnKey, type }: { rowIndex: number; columnKey: string; type: EntityType }) {
  const { data, setEntityRows, errors } = useData();
  const rows = data[type] as any[];
  const value = rows[rowIndex]?.[columnKey] ?? "";
  const fieldErrors = errors.filter(
    (e) => e.entity === type && e.rowIndex === rowIndex && e.field === columnKey
  );
  return (
    <input
      className={
        "px-2 py-1 border outline-none w-full " +
        (fieldErrors.length ? "border-red-500 bg-red-50" : "border-transparent")
      }
      value={value}
      onChange={(e) => {
        setEntityRows(type, (prevRows) => {
          const newRows = [...prevRows];
          newRows[rowIndex] = { ...newRows[rowIndex], [columnKey]: e.target.value };
          return newRows;
        });
      }}
    />
  );
});

// Row wrapper with error highlighting
function DataRow({ row, type, children }: { row: any; type: EntityType; children: React.ReactNode }) {
  const { errors, data, setEntityRows } = useData();
  const rowErrors = errors.filter((e) => e.entity === type && e.rowIndex === row.index);
  const hasErrors = rowErrors.length > 0;

  if (!hasErrors) {
    return <tr className="border-t">{children}</tr>;
  }
  const errorMessages = rowErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
  const mainError = rowErrors[0];

  return (
    <tr
      className="border-t bg-red-50 hover:bg-red-100 transition-colors relative group"
      title={`Validation errors: ${errorMessages}`}
    >
      {children}
    </tr>
  );
}

function getRowDiffs(original: any[], fixed: any[]): { rowIndex: number, changes: { field: string, before: any, after: any }[] }[] {
  const diffs: { rowIndex: number, changes: { field: string, before: any, after: any }[] }[] = [];
  for (let i = 0; i < original.length; ++i) {
    const orig = original[i];
    const fix = fixed[i];
    if (!orig || !fix) continue;
    const changes = Object.keys(fix).filter(k => fix[k] !== orig[k]).map(field => ({
      field,
      before: orig[field],
      after: fix[field],
    }));
    if (changes.length > 0) diffs.push({ rowIndex: i, changes });
  }
  return diffs;
}

function ReviewModal({ open, onClose, fixedRows, onApply, loading, originalRows }: {
  open: boolean;
  onClose: () => void;
  fixedRows: any[];
  onApply: (selected: number[]) => void;
  loading?: boolean;
  originalRows: any[];
}) {
  const diffs = useMemo(() => getRowDiffs(originalRows, fixedRows), [originalRows, fixedRows]);
  const [selected, setSelected] = useState<number[]>(diffs.map(d => d.rowIndex));

  const toggle = (rowIdx: number) => {
    setSelected(sel => sel.includes(rowIdx) ? sel.filter(i => i !== rowIdx) : [...sel, rowIdx]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>Review AI Suggestions</DialogTitle>
        <div className="max-h-96 overflow-auto my-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="animate-spin mr-2">🔄</span>
              <span className="text-sm text-gray-600">AI is working its magic...</span>
            </div>
          ) : diffs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No changes suggested by AI.</div>
          ) : (
            <ul className="space-y-4">
              {diffs.map(({ rowIndex, changes }) => (
                <li key={rowIndex} className="border rounded p-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(rowIndex)}
                    onChange={() => toggle(rowIndex)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold mb-1">Row {rowIndex + 1}</div>
                    <ul className="text-xs space-y-1">
                      {changes.map(({ field, before, after }) => (
                        <li key={field}>
                          <span className="font-mono text-gray-600">{field}</span>: <span className="line-through text-red-500">{String(before)}</span> → <span className="text-green-700 font-mono">{String(after)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-1 rounded bg-muted border" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded bg-primary text-white" onClick={() => onApply(selected)} disabled={loading || diffs.length === 0 || selected.length === 0}>Apply Fixes</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AIFixModal({ open, onClose, errors, type, data, setEntityRows }: { open: boolean; onClose: () => void; errors: any[]; type: EntityType; data: any[]; setEntityRows: any }) {
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [aiResults, setAiResults] = useState<{ [k: number]: string }>({});

  const handleAIFix = async (error: any, idx: number) => {
    setLoadingIdx(idx);
    setAiResults((prev) => ({ ...prev, [idx]: "" }));
    const prompt = `You are a data cleaning assistant. The following row has an error in the '${error.field}' column: ${error.message}.\nRow: ${JSON.stringify(data[error.rowIndex])}.\nSuggest a corrected value for this field only, as a JSON string.`;
    try {
      const res = await fetch("/api/ai-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const result = await res.json();
      if (result && result.value !== undefined) {
        setAiResults((prev) => ({ ...prev, [idx]: result.value }));
        setEntityRows(type, (prevRows: any[]) => {
          const newRows = [...prevRows];
          newRows[error.rowIndex] = { ...newRows[error.rowIndex], [error.field]: result.value };
          return newRows;
        });
      } else {
        setAiResults((prev) => ({ ...prev, [idx]: "No suggestion" }));
      }
    } catch (err) {
      setAiResults((prev) => ({ ...prev, [idx]: "Error" }));
      console.log(err);
    } finally {
      setLoadingIdx(null);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[350px] max-w-[90vw] max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">AI Fix Errors</h2>
          <button className="text-gray-400 hover:text-gray-700 text-xl" onClick={onClose} title="Close">×</button>
        </div>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-2 py-1">Row</th>
              <th className="border px-2 py-1">Column</th>
              <th className="border px-2 py-1">Error</th>
              <th className="border px-2 py-1">Action</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((err, idx) => (
              <tr key={idx}>
                <td className="border px-2 py-1 text-center">{err.rowIndex + 1}</td>
                <td className="border px-2 py-1 font-mono">{err.field}</td>
                <td className="border px-2 py-1">{err.message}</td>
                <td className="border px-2 py-1">
                  <button
                    className="px-2 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50"
                    onClick={() => handleAIFix(err, idx)}
                    disabled={loadingIdx === idx}
                  >
                    {loadingIdx === idx ? "Fixing..." : "Fix with AI"}
                  </button>
                  {aiResults[idx] && (
                    <div className="mt-1 text-xs text-green-700">Suggested: <span className="font-mono">{String(aiResults[idx])}</span></div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="mt-2 px-4 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function ActionCell({ rowIndex, type }: { rowIndex: number; type: EntityType }) {
  const { errors, data, setEntityRows } = useData();
  const cellErrors = errors.filter(e => e.entity === type && e.rowIndex === rowIndex);
  const hasError = cellErrors.length > 0;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[] | null>(null);

  if (!hasError) return null;

  const mainError = cellErrors[0];

  // If the error is for AttributesJSON and the value is plain text, add a suggestion
  let plainTextSuggestion: string | null = null;
  if (mainError.field === 'AttributesJSON') {
    const val = (data[type] as any)[rowIndex]?.[mainError.field];
    if (typeof val === 'string' && val.trim() && (val.trim()[0] !== '{' && val.trim()[0] !== '[')) {
      plainTextSuggestion = JSON.stringify({ message: val.trim() });
    }
  }

  const fetchSuggestions = async () => {
    setLoading(true);
    const rowData = (data[type] as any)[rowIndex];
    const prompt = `The field '${mainError.field}' in the following row has an error: ${mainError.message}.\nRow data: ${JSON.stringify(rowData)}.\n\nProvide up to 3 corrected values for the '${mainError.field}' field as a JSON object: { \"choices\": [ { \"label\": string, \"value\": string } ] }.`;
    try {
      const res = await fetch('/api/ai-fix', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prompt})});
      const json = await res.json();
      if(Array.isArray(json.choices)) setSuggestions(json.choices);
    } catch(err){ console.error(err); }
    setLoading(false);
  };

  const applySuggestion = (val: string) => {
    setEntityRows(type, prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [mainError.field]: val };
      return next;
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={()=>{setOpen(o=>!o); if(!suggestions) fetchSuggestions();}} title="AI suggestions" className="text-xl">
        🤖
      </button>
      {open && (
        <div className="absolute z-50 left-8 top-0 bg-white border rounded-lg shadow-xl p-3 min-w-[280px] text-sm">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">Fix suggestion</h4>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-full hover:bg-gray-200 flex items-center justify-center w-6 h-6"
              title="Close"
            >
              <span className="font-bold text-gray-600"><X /></span>
            </button>
          </div>
          
          <div className="flex flex-col gap-2">
            {loading && <div className="text-xs text-gray-500 px-2 py-1">Loading suggestions...</div>}
            
            {plainTextSuggestion && (
              <>
                <div>
                  <h5 className="text-xs text-gray-500 font-semibold mb-1 px-2">Quick Fix</h5>
                  <button className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-blue-50 border" onClick={()=>applySuggestion(plainTextSuggestion!)}>
                    Wrap as JSON: <span className="font-mono bg-gray-100 p-1 rounded">{plainTextSuggestion}</span>
                  </button>
                </div>
                {(suggestions && suggestions.length > 0) && <hr className="my-1"/>}
              </>
            )}

            {suggestions && suggestions.length > 0 && (
              <div>
                <h5 className="text-xs text-gray-500 font-semibold mb-1 px-2">AI Suggestions</h5>
                {suggestions.map((s,i)=>(
                  <button key={i} className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-blue-50" onClick={()=>applySuggestion(s.value)}>
                    <span className="font-mono bg-gray-100 p-1 rounded">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
            
            {!loading && !suggestions && !plainTextSuggestion && (
              <div className="text-xs text-gray-500 px-2 py-1">No suggestions available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DataGrid({ type }: Props) {
  const { data, setEntityRows } = useData();
  const rows = data[type];
  const { errors } = useData();
  const entityErrors = errors.filter((e) => e.entity === type);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFixedRows, setAiFixedRows] = useState<any[] | null>(null);
  const [aiModalOpen, setAIModalOpen] = useState(false);

  // column keys computed only when structure changes
  const columnKeys = useMemo(() => {
    if (rows.length === 0) return [] as string[];
    return Object.keys(rows[0]);
  }, [type, rows.length > 0 ? Object.keys(rows[0]).join() : ""]);

  const columns = useMemo<ColumnDef<any, any>[]>(() => {
    const actionsCol: ColumnDef<any, any> = {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }: { row: any }) => <ActionCell rowIndex={row.index} type={type} />,
    };
    const dataCols = columnKeys.map((key) => ({
      accessorKey: key,
      header: key,
      cell: ({ row }: { row: any }) => <InputCell rowIndex={row.index} columnKey={key} type={type} />,
    }));
    return [actionsCol, ...dataCols];
  }, [columnKeys, type]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleAIFix() {
    setAiLoading(true);
    setReviewOpen(true);
    setAiFixedRows(null);
    const prompt = buildAutoFixPrompt(type, rows, entityErrors);
    const res = await fetch("/api/ai-fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    setAiFixedRows(data.rows || []);
    setAiLoading(false);
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <AIFixModal
        open={aiModalOpen}
        onClose={() => setAIModalOpen(false)}
        errors={entityErrors}
        type={type}
        data={rows}
        setEntityRows={setEntityRows}
      />
      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        fixedRows={aiFixedRows || []}
        onApply={(selected) => {
          if (aiFixedRows) {
            // Only apply selected fixes
            setEntityRows(type, rows.map((row, i) => selected.includes(i) ? aiFixedRows[i] : row));
          }
          setReviewOpen(false);
        }}
        loading={aiLoading}
        originalRows={rows}
      />
      {entityErrors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <span className="font-medium text-yellow-800">
              {entityErrors.length} validation error{entityErrors.length > 1 ? 's' : ''} found
            </span>
          </div>
          <p className="text-sm text-yellow-700">
            Hover over highlighted rows to see specific issues. Fix the errors to proceed.
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/70 border"
          onClick={() => exportToCSV(rows, `${type}.csv`)}
        >
          Export CSV
        </button>
        <button
          className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/70 border"
          onClick={() => exportToXLSX(rows, `${type}.xlsx`)}
        >
          Export XLSX
        </button>
        {entityErrors.length > 0 && (
          <button
            className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 border flex items-center gap-1"
            onClick={async () => {
              setAiLoading(true);
              setReviewOpen(true);
              setAiFixedRows(null);
              const res = await fetch("/api/ai-fix/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entity: type, rows, errors: entityErrors }),
              });
              const data = await res.json();
              setAiFixedRows(data.rows || []);
              setAiLoading(false);
            }}
            disabled={aiLoading}
            title="Let AI fix all errors in one go!"
          >
            <span role="img" aria-label="magic">✨</span> I'm feeling lucky
          </button>
        )}
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-2 py-1 text-left font-medium">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <DataRow key={row.id} row={row} type={type}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-1">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </DataRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 