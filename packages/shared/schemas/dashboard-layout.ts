import { z } from "zod";

export const CreateDashboardLayoutSchema = z.object({
  userId: z.string(),
  cards: z.array(z.string()).optional(),
  charts: z.array(z.string()).optional(),
  tables: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
  sectionOrder: z.array(z.string()).optional(),
  resourceLayouts: z.unknown(),
  customCharts: z.unknown(),
  datePreset: z.string(),
});

export const UpdateDashboardLayoutSchema = z.object({
  userId: z.string().optional(),
  cards: z.array(z.string()).optional(),
  charts: z.array(z.string()).optional(),
  tables: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
  sectionOrder: z.array(z.string()).optional(),
  resourceLayouts: z.unknown().optional(),
  customCharts: z.unknown().optional(),
  datePreset: z.string().optional(),
});

export type CreateDashboardLayoutInput = z.infer<typeof CreateDashboardLayoutSchema>;
export type UpdateDashboardLayoutInput = z.infer<typeof UpdateDashboardLayoutSchema>;
