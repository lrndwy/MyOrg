import { z } from "zod";

export const CreateDivisionSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.number().int(),
});

export const UpdateDivisionSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateDivisionInput = z.infer<typeof CreateDivisionSchema>;
export type UpdateDivisionInput = z.infer<typeof UpdateDivisionSchema>;
