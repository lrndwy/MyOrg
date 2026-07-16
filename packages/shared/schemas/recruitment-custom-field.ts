import { z } from "zod";

export const CreateRecruitmentCustomFieldSchema = z.object({
  recruitmentId: z.string(),
  recruitment: z.unknown(),
  fieldLabel: z.string(),
  fieldType: z.string(),
  fieldOptions: z.array(z.string()).optional(),
  isRequired: z.boolean(),
  orderIndex: z.number().int(),
  version: z.number().int(),
});

export const UpdateRecruitmentCustomFieldSchema = z.object({
  recruitmentId: z.string().optional(),
  recruitment: z.unknown().optional(),
  fieldLabel: z.string().optional(),
  fieldType: z.string().optional(),
  fieldOptions: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
  version: z.number().int().optional(),
});

export type CreateRecruitmentCustomFieldInput = z.infer<typeof CreateRecruitmentCustomFieldSchema>;
export type UpdateRecruitmentCustomFieldInput = z.infer<typeof UpdateRecruitmentCustomFieldSchema>;
