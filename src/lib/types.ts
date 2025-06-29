export interface Client {
  ClientID: string;
  ClientName: string;
  PriorityLevel: number; // 1–5
  RequestedTaskIDs: string; // comma-separated IDs – keep raw for now
  GroupTag?: string;
  AttributesJSON?: string;
}

export interface Worker {
  WorkerID: string;
  WorkerName: string;
  Skills: string; // comma-separated tags
  AvailableSlots: string; // stringified array – keep raw for now
  MaxLoadPerPhase: number;
  WorkerGroup?: string;
  QualificationLevel?: string;
}

export interface Task {
  TaskID: string;
  TaskName: string;
  Category?: string;
  Duration: number; // phases
  RequiredSkills: string; // comma-separated tags
  PreferredPhases?: string; // list or range syntax
  MaxConcurrent: number;
}

export type EntityType = "clients" | "workers" | "tasks";

export interface Dataset {
  clients: Client[];
  workers: Worker[];
  tasks: Task[];
}

// Business Rules Types
export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  entityType: EntityType | "all";
  field?: string;
  rule: string;
  isActive: boolean;
  priority: number; // 1-10, higher is more important
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessRuleCategory {
  id: string;
  name: string;
  description: string;
  color: string;
} 