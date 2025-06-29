"use client";
import React, { useCallback, useState, useRef } from "react";
import { useData } from "../context/DataContext";
import { EntityType } from "../lib/types";

// Utility: detect entity type by inspecting CSV headers or filename
async function detectEntityType(file: File): Promise<EntityType | null> {
  const tryFilenameHint = () => {
    const name = file.name.toLowerCase();
    if (name.includes("client")) return "clients";
    if (name.includes("worker")) return "workers";
    if (name.includes("task")) return "tasks";
    return null;
  };

  // If CSV, peek at first line for headers
  if (file.name.endsWith(".csv")) {
    const header = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || "";
        resolve(text.split(/\r?\n/)[0] || "");
      };
      // Only read a small chunk for performance
      reader.readAsText(file.slice(0, 1024));
    });
    const cols = header.split(",").map((c) => c.trim());
    if (cols.includes("ClientID")) return "clients";
    if (cols.includes("WorkerID")) return "workers";
    if (cols.includes("TaskID")) return "tasks";
  }
  return tryFilenameHint();
}

export function FileUploader() {
  const { setEntityRows } = useData();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mapping, setMapping] = useState<{ [K in EntityType]?: File }>({});
  const [unmapped, setUnmapped] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statuses, setStatuses] = useState<{ [K in EntityType]?: "pending" | "success" | "error" }>({});
  const [isDragActive, setIsDragActive] = useState(false);
  const dropRef = useRef<HTMLLabelElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setSelectedFiles(files);

    const newMapping: { [K in EntityType]?: File } = {};
    const newUnmapped: File[] = [];

    for (const file of files) {
      const detected = await detectEntityType(file);
      if (detected) {
        newMapping[detected] = file; // if duplicate, last wins
      } else {
        newUnmapped.push(file);
      }
    }
    setMapping(newMapping);
    setUnmapped(newUnmapped);
    setStatuses({});
  };

  const processFiles = useCallback(async () => {
    setIsLoading(true);
    const entities: { type: EntityType; file: File | undefined }[] = [
      { type: "clients", file: mapping.clients },
      { type: "workers", file: mapping.workers },
      { type: "tasks", file: mapping.tasks },
    ];

    await Promise.all(entities.map(async ({ type, file }) => {
      if (!file) return;
      setStatuses((prev) => ({ ...prev, [type]: "pending" }));
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setStatuses((prev) => ({ ...prev, [type]: "error" }));
        alert(data.error || `Upload failed for ${type}`);
        return;
      }
      setEntityRows(type, data.rows);
      setStatuses((prev) => ({ ...prev, [type]: "success" }));
    }));
    setIsLoading(false);
  }, [mapping, setEntityRows]);

  const hasRequired = Boolean(mapping.clients); // clients required as base dataset

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-400 p-8 rounded-md mb-6 bg-white max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">Upload Your Data Files</h2>
      <label
        htmlFor="file-upload"
        ref={dropRef}
        className={
          `block w-full text-center cursor-pointer transition border-2 border-dashed border-gray-400 rounded-lg py-12 mb-6 bg-gray-50 hover:bg-blue-50 focus-within:bg-blue-50 outline-none` +
          (isLoading ? ' opacity-60 pointer-events-none' : '') +
          (isDragActive ? ' border-blue-500 bg-blue-100' : '')
        }
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('file-upload')?.click(); }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          id="file-upload"
          type="file"
          multiple
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          onChange={e => handleFiles(e.target.files)}
          disabled={isLoading}
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center">
          <svg className="w-10 h-10 mb-2 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3.5 3.5M12 8l3.5 3.5M20.5 17.5A5.5 5.5 0 0012 17.5a5.5 5.5 0 00-8.5 0" /></svg>
          <span className="text-lg font-medium text-gray-700">Click or drag files here to upload</span>
          <span className="text-sm text-gray-500 mt-1">CSV or XLSX files, up to 3 at once</span>
          <span className="text-sm text-gray-600 mt-2">{selectedFiles.length > 0 ? selectedFiles.map(f => f.name).join(', ') : 'No file chosen'}</span>
        </div>
      </label>

      {selectedFiles.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Detected Mapping</h3>
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-2 py-1 text-left">Entity</th>
                <th className="border px-2 py-1 text-left">File</th>
                <th className="border px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys({ clients: 1, workers: 1, tasks: 1 }) as EntityType[]).map((entity) => (
                <tr key={entity}>
                  <td className="border px-2 py-1 capitalize">{entity}</td>
                  <td className="border px-2 py-1">
                    {mapping[entity] ? mapping[entity]!.name : <span className="text-gray-400">Not detected</span>}
                  </td>
                  <td className="border px-2 py-1">
                    {statuses[entity] === "success" && <span className="text-green-600">✓ Uploaded</span>}
                    {statuses[entity] === "error" && <span className="text-red-600">✗ Error</span>}
                    {statuses[entity] === "pending" && <span className="text-blue-600">Uploading…</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {unmapped.length > 0 && (
            <div className="mt-4 text-sm text-red-600">
              <strong>Unmapped files:</strong> {unmapped.map((f) => f.name).join(", ")}
            </div>
          )}
        </div>
      )}

      <button
        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 block mx-auto text-lg"
        onClick={processFiles}
        disabled={isLoading || !hasRequired}
      >
        {isLoading ? "Processing…" : "Process Files"}
      </button>
    </div>
  );
} 