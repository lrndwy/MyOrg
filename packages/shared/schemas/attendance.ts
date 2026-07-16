import { z } from "zod";

export const CreateAttendanceSchema = z.object({
  eventId: z.string(),
  event: z.unknown(),
  userId: z.string(),
  user: z.unknown(),
  status: z.string(),
  selfieUrl: z.string(),
  signatureUrl: z.string(),
  checkedInAt: z.string().nullable(),
  version: z.number().int(),
});

export const UpdateAttendanceSchema = z.object({
  eventId: z.string().optional(),
  event: z.unknown().optional(),
  userId: z.string().optional(),
  user: z.unknown().optional(),
  status: z.string().optional(),
  selfieUrl: z.string().optional(),
  signatureUrl: z.string().optional(),
  checkedInAt: z.string().nullable(),
  version: z.number().int().optional(),
});

export type CreateAttendanceInput = z.infer<typeof CreateAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof UpdateAttendanceSchema>;
