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
  const { errors } = useData();
  const rowErrors = errors.filter((e) => e.entity === type && e.rowIndex === row.index);
  const hasErrors = rowErrors.length > 0;

  if (!hasErrors) {
    return <tr className="border-t">{children}</tr>;
  }

  const errorMessages = rowErrors.map((e) => `${e.field}: ${e.message}`).join("; ");

  return (
    <tr 
      className="border-t bg-red-50 hover:bg-red-100 transition-colors relative group"
      title={`Validation errors: ${errorMessages}`}
    >
      {children}
      {/* Error indicator */}
      <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </tr>
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

export function DataGrid({ type }: Props) {
  const { data, setEntityRows } = useData();
  const rows = data[type];
  const { errors } = useData();
  const entityErrors = errors.filter((e) => e.entity === type);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFixedRows, setAiFixedRows] = useState<any[] | null>(null);

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
            <button
              className="ml-4 px-2 py-1 text-xs rounded bg-primary text-white disabled:opacity-50"
              disabled={aiLoading}
              onClick={handleAIFix}
            >
              {aiLoading ? "AI Fixing..." : "Auto-Fix with AI"}
            </button>
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