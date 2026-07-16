import { z } from "zod";

export const CreateTicketSchema = z.object({
  userId: z.string(),
  subject: z.string(),
  description: z.string(),
  status: z.string(),
  priority: z.string(),
  labels: z.string(),
  assigneeId: z.string(),
  lastReplyAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  user: z.unknown(),
  assignee: z.unknown(),
  replies: z.unknown(),
});

export const UpdateTicketSchema = z.object({
  userId: z.string().optional(),
  subject: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  labels: z.string().optional(),
  assigneeId: z.string().optional(),
  lastReplyAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  user: z.unknown().optional(),
  assignee: z.unknown().optional(),
  replies: z.unknown().optional(),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;
