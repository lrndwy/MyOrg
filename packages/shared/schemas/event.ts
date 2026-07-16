import { z } from "zod";

export const CreateEventSchema = z.object({
  title: z.string(),
  description: z.string(),
  divisionId: z.unknown(),
  division: z.unknown(),
  location: z.string(),
  bannerUrl: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  allowPermission: z.boolean(),
  status: z.string(),
  version: z.number().int(),
});

export const UpdateEventSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  divisionId: z.unknown().optional(),
  division: z.unknown().optional(),
  location: z.string().optional(),
  bannerUrl: z.string().optional(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  allowPermission: z.boolean().optional(),
  status: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
