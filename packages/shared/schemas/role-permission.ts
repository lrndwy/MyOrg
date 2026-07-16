import { z } from "zod";

export const CreateRolePermissionSchema = z.object({
  roleId: z.string(),
  role: z.unknown(),
  permissionId: z.string(),
  permission: z.unknown(),
  version: z.number().int(),
});

export const UpdateRolePermissionSchema = z.object({
  roleId: z.string().optional(),
  role: z.unknown().optional(),
  permissionId: z.string().optional(),
  permission: z.unknown().optional(),
  version: z.number().int().optional(),
});

export type CreateRolePermissionInput = z.infer<typeof CreateRolePermissionSchema>;
export type UpdateRolePermissionInput = z.infer<typeof UpdateRolePermissionSchema>;
