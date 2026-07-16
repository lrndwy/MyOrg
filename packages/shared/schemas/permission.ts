import { z } from "zod";

export const CreatePermissionSchema = z.object({
  code: z.string(),
  module: z.string(),
  description: z.string(),
  version: z.number().int(),
});

export const UpdatePermissionSchema = z.object({
  code: z.string().optional(),
  module: z.string().optional(),
  description: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreatePermissionInput = z.infer<typeof CreatePermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof UpdatePermissionSchema>;
