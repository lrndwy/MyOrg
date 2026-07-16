import { z } from "zod";

export const CreateFormShareSchema = z.object({
  resourceName: z.string(),
  token: z.string(),
  hasPassword: z.boolean(),
  enabled: z.boolean(),
  submissionCount: z.number().int(),
  createdByUserId: z.string(),
  label: z.string(),
  customTitle: z.string(),
  customDescription: z.string(),
  hiddenFields: z.array(z.string()).optional(),
});

export const UpdateFormShareSchema = z.object({
  resourceName: z.string().optional(),
  token: z.string().optional(),
  hasPassword: z.boolean().optional(),
  enabled: z.boolean().optional(),
  submissionCount: z.number().int().optional(),
  createdByUserId: z.string().optional(),
  label: z.string().optional(),
  customTitle: z.string().optional(),
  customDescription: z.string().optional(),
  hiddenFields: z.array(z.string()).optional(),
});

export type CreateFormShareInput = z.infer<typeof CreateFormShareSchema>;
export type UpdateFormShareInput = z.infer<typeof UpdateFormShareSchema>;
