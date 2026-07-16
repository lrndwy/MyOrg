import { z } from "zod";

export const CreateUploadSchema = z.object({
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  path: z.string(),
  url: z.string(),
  thumbnailUrl: z.string(),
  userId: z.string(),
  version: z.number().int(),
  claimedAt: z.string().nullable(),
});

export const UpdateUploadSchema = z.object({
  filename: z.string().optional(),
  originalName: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  userId: z.string().optional(),
  version: z.number().int().optional(),
  claimedAt: z.string().nullable(),
});

export type CreateUploadInput = z.infer<typeof CreateUploadSchema>;
export type UpdateUploadInput = z.infer<typeof UpdateUploadSchema>;
