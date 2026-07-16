import { z } from "zod";

export const CreateFlagExposureSchema = z.object({
  flagId: z.string(),
  flagName: z.string(),
  userId: z.string(),
  variant: z.string(),
});

export const UpdateFlagExposureSchema = z.object({
  flagId: z.string().optional(),
  flagName: z.string().optional(),
  userId: z.string().optional(),
  variant: z.string().optional(),
});

export type CreateFlagExposureInput = z.infer<typeof CreateFlagExposureSchema>;
export type UpdateFlagExposureInput = z.infer<typeof UpdateFlagExposureSchema>;
