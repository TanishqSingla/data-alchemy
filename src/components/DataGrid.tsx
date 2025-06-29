"use client";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import { useData } from "../context/DataContext";
import { EntityType } from "../lib/types";
import { useMemo, useState, useRef, useEffect } from "react";
import { exportToCSV, exportToXLSX } from "@/lib/export";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buildAutoFixPrompt } from "@/lib/aiPrompts";
import React from "react";
import { createPortal } from "react-dom";

interface Props {
  type: EntityType;
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
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [coords, setCoords] = useState<{top:number,left:number,height:number} | null>(null);

  useEffect(() => {
    if (rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      setCoords({ top: rect.top + scrollY, left: rect.left, height: rect.height });
    }
  }, []);

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    const currentVal = (data[type] as any)[row.index]?.[rowErrors[0].field] ?? "";
    const prompt = `The value '${currentVal}' in column '${rowErrors[0].field}' has the error: ${rowErrors[0].message}.\nProvide up to 3 possible corrected values as a JSON array of strings.`;
    try {
      const res = await fetch("/api/ai-fix", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ prompt }) });
      const resp = await res.json();
      if (Array.isArray(resp.rows)) {
        setSuggestions(resp.rows.slice(0,3).map(String));
      } else {
        setSuggestions(null);
      }
    } catch(err){ console.error(err); }
    setLoadingSuggestions(false);
  };

  const handleAIFix = async (value: string) => {
    setAiLoading(true);
    setAiResult(null);
    setEntityRows(type, (prevRows) => {
      const newRows = [...prevRows];
      newRows[row.index] = { ...newRows[row.index], [rowErrors[0].field]: value };
      return newRows;
    });
    setAiResult(value);
    setAiLoading(false);
  };

  const buttonNode = coords && createPortal(
    <>
      <button
        className="rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 p-1 border border-blue-200 shadow-sm"
        style={{
          position: "fixed",
          left: coords.left + window.scrollX - 24,
          top: coords.top - window.scrollY + coords.height / 2 - 14,
          minWidth: 28,
          minHeight: 28,
          zIndex: 1000,
        }}
        onClick={e => { e.stopPropagation(); setPopoverOpen(v=>!v); }}
        title="AI Fix"
      >
        <span role="img" aria-label="AI">🤖</span>
      </button>
      {popoverOpen && createPortal(
        <div
          className="bg-white border rounded shadow-lg p-3 min-w-[180px] z-50"
          style={{ position: "absolute", left: coords.left - 200, top: coords.top + coords.height / 2 - 60 }}
          onClick={e=>e.stopPropagation()}
        >
          <div className="font-semibold mb-2 text-sm">AI Fix for <span className="font-mono">{rowErrors[0].field}</span></div>
          <div className="text-xs text-gray-600 mb-2">{rowErrors[0].message}</div>
          {!suggestions && (
            <button className="px-2 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50" disabled={loadingSuggestions} onClick={fetchSuggestions}>{loadingSuggestions?"Loading...":"Get AI Suggestions"}</button>
          )}
          {suggestions && (
            <div className="space-y-1">
              {suggestions.map((s,idx)=>(
                <button key={idx} className="w-full text-left px-2 py-1 rounded border hover:bg-blue-50 text-xs" onClick={()=>handleAIFix(s)}>{s}</button>
              ))}
            </div>
          )}
          {aiResult && <div className="mt-2 text-xs text-green-700">Applied: <span className="font-mono">{String(aiResult)}</span></div>}
          <button className="absolute top-1 right-2 text-gray-400 hover:text-gray-700" onClick={()=>setPopoverOpen(false)} title="Close">×</button>
        </div>, document.body)}
    </>, document.body);

  if (!hasErrors) {
    return <tr className="border-t">{children}</tr>;
  }
  const errorMessages = rowErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
  const mainError = rowErrors[0];

  return (
    <>
      <tr
        ref={rowRef}
        className="border-t bg-red-50 hover:bg-red-100 transition-colors relative group"
        title={`Validation errors: ${errorMessages}`}
      >
        {children}
      </tr>
      {buttonNode}
    </>
  );
}

function ReviewModal({ open, onClose, fixedRows, onApply }: { open: boolean; onClose: () => void; fixedRows: any[]; onApply: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>Review AI Suggestions</DialogTitle>
        <div className="max-h-96 overflow-auto my-4">
          <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">{JSON.stringify(fixedRows, null, 2)}</pre>
        </div>
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-1 rounded bg-muted border" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded bg-primary text-white" onClick={onApply}>Apply Fixes</button>
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
    return columnKeys.map((key) => ({
      accessorKey: key,
      header: key,
      cell: ({ row }) => (
        <InputCell rowIndex={row.index} columnKey={key} type={type} />
      ),
    }));
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
        onApply={() => {
          if (aiFixedRows) setEntityRows(type, aiFixedRows);
          setReviewOpen(false);
        }}
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