import { z } from "zod";

export const CreateLetterAttachmentSchema = z.object({
  letterId: z.string(),
  orderIndex: z.number().int(),
  label: z.string(),
  fileUrl: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  fileKey: z.string(),
  version: z.number().int(),
});

export const UpdateLetterAttachmentSchema = z.object({
  letterId: z.string().optional(),
  orderIndex: z.number().int().optional(),
  label: z.string().optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  fileKey: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateLetterAttachmentInput = z.infer<typeof CreateLetterAttachmentSchema>;
export type UpdateLetterAttachmentInput = z.infer<typeof UpdateLetterAttachmentSchema>;
