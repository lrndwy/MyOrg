import { z } from "zod";

export const CreateActivityLogSchema = z.object({
  userId: z.string(),
  method: z.string(),
  path: z.string(),
  status: z.number().int(),
  payloadDigest: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  durationMs: z.number().int(),
  prevHash: z.string(),
  hash: z.string(),
});

export const UpdateActivityLogSchema = z.object({
  userId: z.string().optional(),
  method: z.string().optional(),
  path: z.string().optional(),
  status: z.number().int().optional(),
  payloadDigest: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  durationMs: z.number().int().optional(),
  prevHash: z.string().optional(),
  hash: z.string().optional(),
});

export type CreateActivityLogInput = z.infer<typeof CreateActivityLogSchema>;
export type UpdateActivityLogInput = z.infer<typeof UpdateActivityLogSchema>;
