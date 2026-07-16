import { z } from "zod";

export const CreateAnnouncementSchema = z.object({
  title: z.string(),
  content: z.string(),
  targetType: z.string(),
  targetDivisionId: z.unknown(),
  targetDivision: z.unknown(),
  publishDate: z.string().nullable(),
  attachments: z.unknown(),
  version: z.number().int(),
});

export const UpdateAnnouncementSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  targetType: z.string().optional(),
  targetDivisionId: z.unknown().optional(),
  targetDivision: z.unknown().optional(),
  publishDate: z.string().nullable(),
  attachments: z.unknown().optional(),
  version: z.number().int().optional(),
});

export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementSchema>;
