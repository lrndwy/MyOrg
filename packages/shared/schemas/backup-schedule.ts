import { z } from "zod";

export const CreateBackupScheduleSchema = z.object({
  frequency: z.string(),
  time: z.string(),
  enabled: z.boolean(),
});

export const UpdateBackupScheduleSchema = z.object({
  frequency: z.string().optional(),
  time: z.string().optional(),
  enabled: z.boolean().optional(),
});

export type CreateBackupScheduleInput = z.infer<typeof CreateBackupScheduleSchema>;
export type UpdateBackupScheduleInput = z.infer<typeof UpdateBackupScheduleSchema>;
