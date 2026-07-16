import { z } from "zod";

export const CreateUserActivitySchema = z.object({
  userId: z.string(),
  action: z.string(),
  severity: z.string(),
  summary: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  metadata: z.string(),
});

export const UpdateUserActivitySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  severity: z.string().optional(),
  summary: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.string().optional(),
});

export type CreateUserActivityInput = z.infer<typeof CreateUserActivitySchema>;
export type UpdateUserActivityInput = z.infer<typeof UpdateUserActivitySchema>;
