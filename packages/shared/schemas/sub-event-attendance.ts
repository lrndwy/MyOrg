import { z } from "zod";

export const CreateSubEventAttendanceSchema = z.object({
  subEventId: z.string(),
  subEvent: z.unknown(),
  userId: z.string(),
  user: z.unknown(),
  status: z.string(),
  selfieUrl: z.string(),
  signatureUrl: z.string(),
  checkedInAt: z.string().nullable(),
  markedById: z.unknown(),
  markedBy: z.unknown(),
  version: z.number().int(),
});

export const UpdateSubEventAttendanceSchema = z.object({
  subEventId: z.string().optional(),
  subEvent: z.unknown().optional(),
  userId: z.string().optional(),
  user: z.unknown().optional(),
  status: z.string().optional(),
  selfieUrl: z.string().optional(),
  signatureUrl: z.string().optional(),
  checkedInAt: z.string().nullable(),
  markedById: z.unknown().optional(),
  markedBy: z.unknown().optional(),
  version: z.number().int().optional(),
});

export type CreateSubEventAttendanceInput = z.infer<typeof CreateSubEventAttendanceSchema>;
export type UpdateSubEventAttendanceInput = z.infer<typeof UpdateSubEventAttendanceSchema>;
