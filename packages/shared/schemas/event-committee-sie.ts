import { z } from "zod";

export const CreateEventCommitteeSieSchema = z.object({
  eventId: z.string(),
  event: z.unknown(),
  name: z.string(),
  description: z.string(),
  orderIndex: z.number().int(),
  version: z.number().int(),
});

export const UpdateEventCommitteeSieSchema = z.object({
  eventId: z.string().optional(),
  event: z.unknown().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  orderIndex: z.number().int().optional(),
  version: z.number().int().optional(),
});

export type CreateEventCommitteeSieInput = z.infer<typeof CreateEventCommitteeSieSchema>;
export type UpdateEventCommitteeSieInput = z.infer<typeof UpdateEventCommitteeSieSchema>;
