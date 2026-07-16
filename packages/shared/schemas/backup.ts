import { z } from "zod";

export const CreateBackupSchema = z.object({
  kind: z.string(),
  status: z.string(),
  sizeBytes: z.number().int(),
  tableCount: z.number().int(),
  rowCount: z.number().int(),
  error: z.string(),
  completedAt: z.string().nullable(),
});

export const UpdateBackupSchema = z.object({
  kind: z.string().optional(),
  status: z.string().optional(),
  sizeBytes: z.number().int().optional(),
  tableCount: z.number().int().optional(),
  rowCount: z.number().int().optional(),
  error: z.string().optional(),
  completedAt: z.string().nullable(),
});

export type CreateBackupInput = z.infer<typeof CreateBackupSchema>;
export type UpdateBackupInput = z.infer<typeof UpdateBackupSchema>;
