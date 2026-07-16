import { z } from "zod";

export const CreateLetterSignatureSchema = z.object({
  letterId: z.string(),
  orderIndex: z.number().int(),
  positionTitle: z.string(),
  fullName: z.string(),
  idNumber: z.string(),
  version: z.number().int(),
});

export const UpdateLetterSignatureSchema = z.object({
  letterId: z.string().optional(),
  orderIndex: z.number().int().optional(),
  positionTitle: z.string().optional(),
  fullName: z.string().optional(),
  idNumber: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateLetterSignatureInput = z.infer<typeof CreateLetterSignatureSchema>;
export type UpdateLetterSignatureInput = z.infer<typeof UpdateLetterSignatureSchema>;
