import { z } from "zod";

export const CreateRecruitmentSchema = z.object({
  title: z.string(),
  description: z.string(),
  slug: z.string(),
  openDate: z.string().nullable(),
  closeDate: z.string().nullable(),
  status: z.string(),
  version: z.number().int(),
});

export const UpdateRecruitmentSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().optional(),
  openDate: z.string().nullable(),
  closeDate: z.string().nullable(),
  status: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateRecruitmentInput = z.infer<typeof CreateRecruitmentSchema>;
export type UpdateRecruitmentInput = z.infer<typeof UpdateRecruitmentSchema>;
