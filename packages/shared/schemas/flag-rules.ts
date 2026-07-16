import { z } from "zod";

export const CreateFlagRulesSchema = z.object({
  rolloutPercentage: z.number().int(),
  allowlistUserIds: z.unknown(),
  blocklistUserIds: z.unknown(),
  enabledFrom: z.string().nullable(),
  enabledUntil: z.string().nullable(),
  variants: z.unknown(),
});

export const UpdateFlagRulesSchema = z.object({
  rolloutPercentage: z.number().int().optional(),
  allowlistUserIds: z.unknown().optional(),
  blocklistUserIds: z.unknown().optional(),
  enabledFrom: z.string().nullable(),
  enabledUntil: z.string().nullable(),
  variants: z.unknown().optional(),
});

export type CreateFlagRulesInput = z.infer<typeof CreateFlagRulesSchema>;
export type UpdateFlagRulesInput = z.infer<typeof UpdateFlagRulesSchema>;
