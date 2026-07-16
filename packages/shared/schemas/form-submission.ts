import { z } from "zod";

export const CreateFormSubmissionSchema = z.object({
  shareId: z.string(),
  resourceName: z.string(),
  recordId: z.string(),
  ip: z.string(),
  userAgent: z.string(),
});

export const UpdateFormSubmissionSchema = z.object({
  shareId: z.string().optional(),
  resourceName: z.string().optional(),
  recordId: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});

export type CreateFormSubmissionInput = z.infer<typeof CreateFormSubmissionSchema>;
export type UpdateFormSubmissionInput = z.infer<typeof UpdateFormSubmissionSchema>;
