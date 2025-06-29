import { z } from "zod";

export const clientSchema = z.object({
  ClientID: z.string().min(1),
  ClientName: z.string().min(1),
  PriorityLevel: z.preprocess((v) => Number(v), z.number().int().min(1).max(5)),
  RequestedTaskIDs: z.string().optional().default(""),
  GroupTag: z.string().optional(),
  AttributesJSON: z.string().optional(),
});

export const workerSchema = z.object({
  WorkerID: z.string().min(1),
  WorkerName: z.string().min(1),
  Skills: z.string().optional().default(""),
  AvailableSlots: z.string().optional().default("[]"),
  MaxLoadPerPhase: z.preprocess((v) => Number(v), z.number().int().nonnegative()),
  WorkerGroup: z.string().optional(),
  QualificationLevel: z.string().optional(),
});

export const taskSchema = z.object({
  TaskID: z.string().min(1),
  TaskName: z.string().min(1),
  Category: z.string().optional(),
  Duration: z.preprocess((v) => Number(v), z.number().int().min(1)),
  RequiredSkills: z.string().optional().default(""),
  PreferredPhases: z.string().optional(),
  MaxConcurrent: z.preprocess((v) => Number(v), z.number().int().min(1)),
});

export const schemas = {
  clients: clientSchema,
  workers: workerSchema,
  tasks: taskSchema,
}; 