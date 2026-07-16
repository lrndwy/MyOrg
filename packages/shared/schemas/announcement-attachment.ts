import { z } from "zod";

export const CreateAnnouncementAttachmentSchema = z.object({
  announcementId: z.string(),
  announcement: z.unknown(),
  fileUrl: z.string(),
  fileType: z.string(),
  version: z.number().int(),
});

export const UpdateAnnouncementAttachmentSchema = z.object({
  announcementId: z.string().optional(),
  announcement: z.unknown().optional(),
  fileUrl: z.string().optional(),
  fileType: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateAnnouncementAttachmentInput = z.infer<typeof CreateAnnouncementAttachmentSchema>;
export type UpdateAnnouncementAttachmentInput = z.infer<typeof UpdateAnnouncementAttachmentSchema>;
