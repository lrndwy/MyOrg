import { z } from "zod";

export const CreateRoleSchema = z.object({
  name: z.string(),
  description: z.string(),
  isSystem: z.boolean(),
  version: z.number().int(),
});

export const UpdateRoleSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  isSystem: z.boolean().optional(),
  version: z.number().int().optional(),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
