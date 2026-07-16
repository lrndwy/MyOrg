import { z } from "zod";

export const CreateLetterCategorySchema = z.object({
  name: z.string(),
  code: z.string(),
  startNumber: z.number().int(),
  currentNumber: z.number().int(),
  numberFormatTemplate: z.string(),
  version: z.number().int(),
});

export const UpdateLetterCategorySchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  startNumber: z.number().int().optional(),
  currentNumber: z.number().int().optional(),
  numberFormatTemplate: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateLetterCategoryInput = z.infer<typeof CreateLetterCategorySchema>;
export type UpdateLetterCategoryInput = z.infer<typeof UpdateLetterCategorySchema>;
