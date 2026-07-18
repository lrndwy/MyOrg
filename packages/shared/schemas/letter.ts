import { z } from "zod";

export const CreateLetterSchema = z.object({
  type: z.string(),
  categoryId: z.string(),
  category: z.unknown(),
  templateId: z.unknown(),
  template: z.unknown(),
  letterCode: z.string(),
  subject: z.string(),
  letterDate: z.string().nullable(),
  sender: z.string(),
  recipient: z.string(),
  content: z.string(),
  variableValues: z.unknown(),
  documentUrl: z.string(),
  attachmentUrl: z.string(),
  version: z.number().int(),
});

export const UpdateLetterSchema = z.object({
  type: z.string().optional(),
  categoryId: z.string().optional(),
  category: z.unknown().optional(),
  templateId: z.unknown().optional(),
  template: z.unknown().optional(),
  letterCode: z.string().optional(),
  subject: z.string().optional(),
  letterDate: z.string().nullable(),
  sender: z.string().optional(),
  recipient: z.string().optional(),
  content: z.string().optional(),
  variableValues: z.unknown().optional(),
  documentUrl: z.string().optional(),
  attachmentUrl: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateLetterInput = z.infer<typeof CreateLetterSchema>;
export type UpdateLetterInput = z.infer<typeof UpdateLetterSchema>;
