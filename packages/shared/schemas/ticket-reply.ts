import { z } from "zod";

export const CreateTicketReplySchema = z.object({
  ticketId: z.string(),
  userId: z.string(),
  body: z.string(),
  isAdminReply: z.boolean(),
  user: z.unknown(),
});

export const UpdateTicketReplySchema = z.object({
  ticketId: z.string().optional(),
  userId: z.string().optional(),
  body: z.string().optional(),
  isAdminReply: z.boolean().optional(),
  user: z.unknown().optional(),
});

export type CreateTicketReplyInput = z.infer<typeof CreateTicketReplySchema>;
export type UpdateTicketReplyInput = z.infer<typeof UpdateTicketReplySchema>;
