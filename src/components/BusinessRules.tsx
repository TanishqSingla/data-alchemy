"use client";
import React, { useState } from "react";
import { useBusinessRules } from "../context/BusinessRulesContext";
import { BusinessRule, EntityType } from "../lib/types";

interface RuleFormData {
  name: string;
  description: string;
  entityType: EntityType | "all";
  field: string;
  rule: string;
  priority: number;
  isActive: boolean;
}

export function BusinessRules() {
  const { rules, addRule, updateRule, deleteRule, toggleRule } = useBusinessRules();
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState<EntityType | "all">("all");
  const [filterActive, setFilterActive] = useState<boolean | "all">("all");
  const [isExpanded, setIsExpanded] = useState(false);

  const [formData, setFormData] = useState<RuleFormData>({
    name: "",
    description: "",
    entityType: "clients",
    field: "",
    rule: "",
    priority: 5,
    isActive: true
  });

  const entityOptions = [
    { value: "all", label: "All Entities" },
    { value: "clients", label: "Clients" },
    { value: "workers", label: "Workers" },
    { value: "tasks", label: "Tasks" }
  ];

  const fieldOptions = {
    clients: ["ClientID", "ClientName", "PriorityLevel", "RequestedTaskIDs", "GroupTag", "AttributesJSON"],
    workers: ["WorkerID", "WorkerName", "Skills", "AvailableSlots", "MaxLoadPerPhase", "WorkerGroup", "QualificationLevel"],
    tasks: ["TaskID", "TaskName", "Category", "Duration", "RequiredSkills", "PreferredPhases", "MaxConcurrent"]
  };

  const filteredRules = rules.filter(rule => {
    if (filterEntity !== "all" && rule.entityType !== "all" && rule.entityType !== filterEntity) return false;
    if (filterActive !== "all" && rule.isActive !== filterActive) return false;
    return true;
  });

  const activeRulesCount = rules.filter(rule => rule.isActive).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateRule(editingRule, formData);
      setEditingRule(null);
    } else {
      addRule(formData);
    }
    setFormData({
      name: "",
      description: "",
      entityType: "clients",
      field: "",
      rule: "",
      priority: 5,
      isActive: true
    });
    setIsAddingRule(false);
  };

  const handleEdit = (rule: BusinessRule) => {
    setEditingRule(rule.id);
    setFormData({
      name: rule.name,
      description: rule.description,
      entityType: rule.entityType,
      field: rule.field || "",
      rule: rule.rule,
      priority: rule.priority,
      isActive: rule.isActive
    });
    setIsAddingRule(true);
  };

  const handleCancel = () => {
    setIsAddingRule(false);
    setEditingRule(null);
    setFormData({
      name: "",
      description: "",
      entityType: "clients",
      field: "",
      rule: "",
      priority: 5,
      isActive: true
    });
  };

  const getCurrentFields = () => {
    if (formData.entityType === "all") return [];
    return fieldOptions[formData.entityType as EntityType] || [];
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      {/* Header with collapse functionality */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <svg 
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <h2 className="text-xl font-bold">Business Rules</h2>
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
              {activeRulesCount} active
            </span>
          </button>
        </div>
        <button
          onClick={() => {
            setIsExpanded(true);
            setIsAddingRule(true);
          }}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Rule
        </button>
      </div>

      {!isExpanded && (
        <div className="text-gray-600 text-sm">
          <p>Define custom rules to guide AI data cleaning and validation. {activeRulesCount} rules are currently active.</p>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-blue-600 hover:text-blue-800 text-sm mt-2"
          >
            Click to expand and manage rules →
          </button>
        </div>
      )}

      {isExpanded && (
        <>
          <p className="text-gray-600 mb-6">
            Define custom rules to guide AI data cleaning and validation
          </p>

          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Entity:</label>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value as EntityType | "all")}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                {entityOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={filterActive === "all" ? "all" : filterActive.toString()}
                onChange={(e) => setFilterActive(e.target.value === "all" ? "all" : e.target.value === "true")}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {/* Add/Edit Rule Form */}
          {isAddingRule && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingRule ? "Edit Business Rule" : "Add New Business Rule"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Client Priority Validation"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Entity Type *
                    </label>
                    <select
                      value={formData.entityType}
                      onChange={(e) => setFormData({ ...formData, entityType: e.target.value as EntityType | "all" })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {entityOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief description of what this rule does"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field (Optional)
                    </label>
                    <select
                      value={formData.field}
                      onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Fields</option>
                      {getCurrentFields().map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority (1-10)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                  <span className="text-xs text-gray-500">
                    Active rules are applied during AI data cleaning
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Description *
                  </label>
                  <textarea
                    value={formData.rule}
                    onChange={(e) => setFormData({ ...formData, rule: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Describe what the AI should do when this rule is applied. Be specific about the expected behavior."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Example: "Priority levels must be between 1 and 5. If outside this range, set to 3 as default."
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {editingRule ? "Update Rule" : "Add Rule"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rules List */}
          <div className="space-y-4">
            {filteredRules.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No business rules found. Create your first rule to get started!</p>
              </div>
            ) : (
              filteredRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`border rounded-lg p-4 transition-all ${
                    rule.isActive 
                      ? "border-green-200 bg-green-50" 
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-800">{rule.name}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          rule.isActive 
                            ? "bg-green-100 text-green-800" 
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {rule.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Priority: {rule.priority}
                        </span>
                      </div>
                      
                      {rule.description && (
                        <p className="text-gray-600 text-sm mb-2">{rule.description}</p>
                      )}
                      
                      <div className="text-sm text-gray-500 mb-2">
                        <span className="font-medium">Entity:</span> {rule.entityType === "all" ? "All Entities" : rule.entityType}
                        {rule.field && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="font-medium">Field:</span> {rule.field}
                          </>
                        )}
                      </div>
                      
                      <div className="bg-white border border-gray-200 rounded p-3">
                        <p className="text-sm text-gray-700">{rule.rule}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className={`p-2 rounded-md transition-colors ${
                          rule.isActive
                            ? "text-green-600 hover:bg-green-100"
                            : "text-gray-400 hover:bg-gray-100"
                        }`}
                        title={rule.isActive ? "Deactivate rule" : "Activate rule"}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                        title="Edit rule"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                        title="Delete rule"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Help Section */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">💡 How to Use Business Rules</h4>
            <div className="text-sm text-blue-700 space-y-2">
              <p>• <strong>Rule Name:</strong> Give your rule a clear, descriptive name</p>
              <p>• <strong>Entity Type:</strong> Choose which data type this rule applies to (or "All Entities")</p>
              <p>• <strong>Field:</strong> Optionally specify a particular field, or leave blank for all fields</p>
              <p>• <strong>Priority:</strong> Higher priority rules (8-10) are applied first</p>
              <p>• <strong>Rule Description:</strong> Explain in plain English what the AI should do</p>
              <p>• <strong>Active/Inactive:</strong> Toggle rules on/off without deleting them</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 