import { z } from "zod";

export const CreateTwoFactorConfigSchema = z.object({
  userId: z.string(),
  enabled: z.boolean(),
});

export const UpdateTwoFactorConfigSchema = z.object({
  userId: z.string().optional(),
  enabled: z.boolean().optional(),
});

export type CreateTwoFactorConfigInput = z.infer<typeof CreateTwoFactorConfigSchema>;
export type UpdateTwoFactorConfigInput = z.infer<typeof UpdateTwoFactorConfigSchema>;
