import { z } from "zod";

export const CreateWebhookEventSchema = z.object({
  provider: z.string(),
  eventType: z.string(),
  externalId: z.string(),
  payload: z.unknown(),
  status: z.string(),
  handlerError: z.string(),
  retryCount: z.number().int(),
  processedAt: z.string().nullable(),
});

export const UpdateWebhookEventSchema = z.object({
  provider: z.string().optional(),
  eventType: z.string().optional(),
  externalId: z.string().optional(),
  payload: z.unknown().optional(),
  status: z.string().optional(),
  handlerError: z.string().optional(),
  retryCount: z.number().int().optional(),
  processedAt: z.string().nullable(),
});

export type CreateWebhookEventInput = z.infer<typeof CreateWebhookEventSchema>;
export type UpdateWebhookEventInput = z.infer<typeof UpdateWebhookEventSchema>;
