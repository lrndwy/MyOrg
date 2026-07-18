import { z } from "zod";

export const CreateFinanceCategorySchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  version: z.number().int(),
});

export const UpdateFinanceCategorySchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateFinanceCategoryInput = z.infer<typeof CreateFinanceCategorySchema>;
export type UpdateFinanceCategoryInput = z.infer<typeof UpdateFinanceCategorySchema>;
