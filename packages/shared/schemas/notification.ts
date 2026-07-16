import { z } from "zod";

export const CreateNotificationSchema = z.object({
  userId: z.string(),
  source: z.string(),
  severity: z.string(),
  title: z.string(),
  body: z.string(),
  link: z.string(),
  count: z.number().int(),
  readAt: z.string().nullable(),
});

export const UpdateNotificationSchema = z.object({
  userId: z.string().optional(),
  source: z.string().optional(),
  severity: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  link: z.string().optional(),
  count: z.number().int().optional(),
  readAt: z.string().nullable(),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
export type UpdateNotificationInput = z.infer<typeof UpdateNotificationSchema>;
