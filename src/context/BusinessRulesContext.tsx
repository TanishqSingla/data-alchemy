"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { BusinessRule, BusinessRuleCategory, EntityType } from "../lib/types";

interface BusinessRulesContextValue {
  rules: BusinessRule[];
  categories: BusinessRuleCategory[];
  addRule: (rule: Omit<BusinessRule, "id" | "createdAt" | "updatedAt">) => void;
  updateRule: (id: string, updates: Partial<BusinessRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  getActiveRules: (entityType?: EntityType) => BusinessRule[];
  addCategory: (category: Omit<BusinessRuleCategory, "id">) => void;
  updateCategory: (id: string, updates: Partial<BusinessRuleCategory>) => void;
  deleteCategory: (id: string) => void;
}

const BusinessRulesContext = createContext<BusinessRulesContextValue | undefined>(undefined);

export function useBusinessRules() {
  const ctx = useContext(BusinessRulesContext);
  if (!ctx) throw new Error("useBusinessRules must be used within BusinessRulesProvider");
  return ctx;
}

// Default categories
const defaultCategories: BusinessRuleCategory[] = [
  {
    id: "data-quality",
    name: "Data Quality",
    description: "Rules for ensuring data accuracy and consistency",
    color: "#3B82F6"
  },
  {
    id: "business-logic",
    name: "Business Logic",
    description: "Rules based on business requirements and constraints",
    color: "#10B981"
  },
  {
    id: "formatting",
    name: "Formatting",
    description: "Rules for data formatting and presentation",
    color: "#F59E0B"
  },
  {
    id: "validation",
    name: "Validation",
    description: "Rules for data validation and integrity",
    color: "#EF4444"
  }
];

// Default business rules
const defaultRules: BusinessRule[] = [
  {
    id: "1",
    name: "Client Priority Validation",
    description: "Ensure client priority levels are between 1-5",
    entityType: "clients",
    field: "PriorityLevel",
    rule: "Priority levels must be between 1 and 5. If outside this range, set to 3 as default.",
    isActive: true,
    priority: 8,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "2",
    name: "Worker Skills Format",
    description: "Ensure worker skills are properly formatted as comma-separated values",
    entityType: "workers",
    field: "Skills",
    rule: "Skills should be comma-separated. If semicolons are used, convert to commas. Remove any empty entries.",
    isActive: true,
    priority: 6,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "3",
    name: "Task Duration Validation",
    description: "Ensure task durations are positive numbers",
    entityType: "tasks",
    field: "Duration",
    rule: "Task duration must be a positive number. If zero or negative, set to 1 as minimum.",
    isActive: true,
    priority: 7,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export function BusinessRulesProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [categories, setCategories] = useState<BusinessRuleCategory[]>(defaultCategories);

  // Load rules from localStorage on mount
  useEffect(() => {
    const savedRules = localStorage.getItem("businessRules");
    const savedCategories = localStorage.getItem("businessRuleCategories");
    
    if (savedRules) {
      try {
        const parsedRules = JSON.parse(savedRules);
        // Convert date strings back to Date objects
        const rulesWithDates = parsedRules.map((rule: any) => ({
          ...rule,
          createdAt: new Date(rule.createdAt),
          updatedAt: new Date(rule.updatedAt)
        }));
        setRules(rulesWithDates);
      } catch (error) {
        console.error("Failed to parse saved rules:", error);
        setRules(defaultRules);
      }
    } else {
      setRules(defaultRules);
    }

    if (savedCategories) {
      try {
        setCategories(JSON.parse(savedCategories));
      } catch (error) {
        console.error("Failed to parse saved categories:", error);
        setCategories(defaultCategories);
      }
    }
  }, []);

  // Save rules to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("businessRules", JSON.stringify(rules));
  }, [rules]);

  // Save categories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("businessRuleCategories", JSON.stringify(categories));
  }, [categories]);

  const addRule = (ruleData: Omit<BusinessRule, "id" | "createdAt" | "updatedAt">) => {
    const newRule: BusinessRule = {
      ...ruleData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setRules(prev => [...prev, newRule]);
  };

  const updateRule = (id: string, updates: Partial<BusinessRule>) => {
    setRules(prev => prev.map(rule => 
      rule.id === id 
        ? { ...rule, ...updates, updatedAt: new Date() }
        : rule
    ));
  };

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(rule => rule.id !== id));
  };

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === id 
        ? { ...rule, isActive: !rule.isActive, updatedAt: new Date() }
        : rule
    ));
  };

  const getActiveRules = (entityType?: EntityType) => {
    return rules
      .filter(rule => rule.isActive)
      .filter(rule => !entityType || rule.entityType === "all" || rule.entityType === entityType)
      .sort((a, b) => b.priority - a.priority);
  };

  const addCategory = (categoryData: Omit<BusinessRuleCategory, "id">) => {
    const newCategory: BusinessRuleCategory = {
      ...categoryData,
      id: Date.now().toString()
    };
    setCategories(prev => [...prev, newCategory]);
  };

  const updateCategory = (id: string, updates: Partial<BusinessRuleCategory>) => {
    setCategories(prev => prev.map(category => 
      category.id === id ? { ...category, ...updates } : category
    ));
  };

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(category => category.id !== id));
  };

  const value: BusinessRulesContextValue = {
    rules,
    categories,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    getActiveRules,
    addCategory,
    updateCategory,
    deleteCategory
  };

  return (
    <BusinessRulesContext.Provider value={value}>
      {children}
    </BusinessRulesContext.Provider>
  );
} 