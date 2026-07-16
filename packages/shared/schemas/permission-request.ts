import { z } from "zod";

export const CreatePermissionRequestSchema = z.object({
  eventId: z.string(),
  event: z.unknown(),
  userId: z.string(),
  user: z.unknown(),
  reason: z.string(),
  proofUrl: z.string(),
  status: z.string(),
  reviewedById: z.unknown(),
  reviewedBy: z.unknown(),
  reviewNote: z.string(),
  reviewedAt: z.string().nullable(),
  version: z.number().int(),
});

export const UpdatePermissionRequestSchema = z.object({
  eventId: z.string().optional(),
  event: z.unknown().optional(),
  userId: z.string().optional(),
  user: z.unknown().optional(),
  reason: z.string().optional(),
  proofUrl: z.string().optional(),
  status: z.string().optional(),
  reviewedById: z.unknown().optional(),
  reviewedBy: z.unknown().optional(),
  reviewNote: z.string().optional(),
  reviewedAt: z.string().nullable(),
  version: z.number().int().optional(),
});

export type CreatePermissionRequestInput = z.infer<typeof CreatePermissionRequestSchema>;
export type UpdatePermissionRequestInput = z.infer<typeof UpdatePermissionRequestSchema>;
