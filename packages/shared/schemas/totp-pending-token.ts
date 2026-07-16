import { z } from "zod";

export const CreateTOTPPendingTokenSchema = z.object({
  userId: z.string(),
  expiresAt: z.string(),
});

export const UpdateTOTPPendingTokenSchema = z.object({
  userId: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type CreateTOTPPendingTokenInput = z.infer<typeof CreateTOTPPendingTokenSchema>;
export type UpdateTOTPPendingTokenInput = z.infer<typeof UpdateTOTPPendingTokenSchema>;
