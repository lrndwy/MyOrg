import { z } from "zod";

export const CreateViolationSchema = z.object({
  userId: z.string(),
  user: z.unknown(),
  violationType: z.string(),
  description: z.string(),
  spLevel: z.string(),
  documentUrl: z.string(),
  issuedById: z.string(),
  issuedBy: z.unknown(),
  issuedDate: z.string().nullable(),
  version: z.number().int(),
});

export const UpdateViolationSchema = z.object({
  userId: z.string().optional(),
  user: z.unknown().optional(),
  violationType: z.string().optional(),
  description: z.string().optional(),
  spLevel: z.string().optional(),
  documentUrl: z.string().optional(),
  issuedById: z.string().optional(),
  issuedBy: z.unknown().optional(),
  issuedDate: z.string().nullable(),
  version: z.number().int().optional(),
});

export type CreateViolationInput = z.infer<typeof CreateViolationSchema>;
export type UpdateViolationInput = z.infer<typeof UpdateViolationSchema>;
