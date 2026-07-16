import { z } from "zod";

export const CreateTrustedDeviceSchema = z.object({
  userId: z.string(),
  userAgent: z.string(),
  ipAddress: z.string(),
  expiresAt: z.string(),
});

export const UpdateTrustedDeviceSchema = z.object({
  userId: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type CreateTrustedDeviceInput = z.infer<typeof CreateTrustedDeviceSchema>;
export type UpdateTrustedDeviceInput = z.infer<typeof UpdateTrustedDeviceSchema>;
