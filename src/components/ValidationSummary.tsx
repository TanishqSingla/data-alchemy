"use client";
import { useData } from "../context/DataContext";

export function ValidationSummary() {
  const { errors } = useData();
  if (errors.length === 0) return null;

  return (
    <div className="border border-red-400 bg-red-50 p-4 rounded-md mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </div>
        <h3 className="font-semibold text-red-700">
          {errors.length} Validation Error{errors.length > 1 ? 's' : ''} Found
        </h3>
      </div>
      
      <div className="text-sm text-red-700 mb-3">
        <p className="mb-2">Please fix the following issues to ensure data quality:</p>
        <ul className="space-y-1 max-h-40 overflow-auto">
          {errors.map((e, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-red-500 mt-1">•</span>
              <span>
                <strong>{e.entity}</strong> Row {e.rowIndex + 1}: <code className="bg-red-100 px-1 rounded">{e.field}</code> - {e.message}
              </span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="bg-red-100 border border-red-200 rounded p-3">
        <p className="text-sm text-red-800 font-medium mb-1">💡 Quick Fix Tips:</p>
        <ul className="text-xs text-red-700 space-y-1">
          <li>• Edit cells directly in the highlighted rows below</li>
          <li>• Ensure IDs are unique across each table</li>
          <li>• Check that referenced TaskIDs exist in the Tasks table</li>
          <li>• Verify JSON syntax in AttributesJSON fields</li>
          <li>• Make sure numeric fields contain valid numbers</li>
        </ul>
      </div>
    </div>
  );
} 