import { z } from "zod";

export const CreateEventSubEventSchema = z.object({
  eventId: z.string(),
  event: z.unknown(),
  sieId: z.string(),
  sie: z.unknown(),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  ketuaPelaksanaId: z.string(),
  ketuaPelaksana: z.unknown(),
  attendanceMode: z.string(),
  minutesUrl: z.string(),
  status: z.string(),
  version: z.number().int(),
});

export const UpdateEventSubEventSchema = z.object({
  eventId: z.string().optional(),
  event: z.unknown().optional(),
  sieId: z.string().optional(),
  sie: z.unknown().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  ketuaPelaksanaId: z.string().optional(),
  ketuaPelaksana: z.unknown().optional(),
  attendanceMode: z.string().optional(),
  minutesUrl: z.string().optional(),
  status: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateEventSubEventInput = z.infer<typeof CreateEventSubEventSchema>;
export type UpdateEventSubEventInput = z.infer<typeof UpdateEventSubEventSchema>;
