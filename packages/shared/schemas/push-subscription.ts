import { z } from "zod";

export const CreatePushSubscriptionSchema = z.object({
  userId: z.string(),
  endpoint: z.string(),
  userAgent: z.string(),
});

export const UpdatePushSubscriptionSchema = z.object({
  userId: z.string().optional(),
  endpoint: z.string().optional(),
  userAgent: z.string().optional(),
});

export type CreatePushSubscriptionInput = z.infer<typeof CreatePushSubscriptionSchema>;
export type UpdatePushSubscriptionInput = z.infer<typeof UpdatePushSubscriptionSchema>;
