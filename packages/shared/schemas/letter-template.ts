import { z } from "zod";

export const CreateLetterTemplateSchema = z.object({
  name: z.string(),
  categoryId: z.string(),
  category: z.unknown(),
  templateUrl: z.string(),
  version: z.number().int(),
});

export const UpdateLetterTemplateSchema = z.object({
  name: z.string().optional(),
  categoryId: z.string().optional(),
  category: z.unknown().optional(),
  templateUrl: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateLetterTemplateInput = z.infer<typeof CreateLetterTemplateSchema>;
export type UpdateLetterTemplateInput = z.infer<typeof UpdateLetterTemplateSchema>;
