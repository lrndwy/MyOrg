import { z } from "zod";

export const CreateEventCommitteeMemberSchema = z.object({
  sieId: z.string(),
  sie: z.unknown(),
  userId: z.string(),
  user: z.unknown(),
  role: z.string(),
  version: z.number().int(),
});

export const UpdateEventCommitteeMemberSchema = z.object({
  sieId: z.string().optional(),
  sie: z.unknown().optional(),
  userId: z.string().optional(),
  user: z.unknown().optional(),
  role: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateEventCommitteeMemberInput = z.infer<typeof CreateEventCommitteeMemberSchema>;
export type UpdateEventCommitteeMemberInput = z.infer<typeof UpdateEventCommitteeMemberSchema>;
