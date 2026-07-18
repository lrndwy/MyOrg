import { z } from "zod";

export const CreateFinanceTransactionSchema = z.object({
  type: z.string(),
  amount: z.number(),
  description: z.string(),
  proofUrl: z.string(),
  transactionDate: z.string().nullable(),
  categoryId: z.string(),
  category: z.unknown(),
  recordedById: z.string(),
  recordedBy: z.unknown(),
  version: z.number().int(),
});

export const UpdateFinanceTransactionSchema = z.object({
  type: z.string().optional(),
  amount: z.number().optional(),
  description: z.string().optional(),
  proofUrl: z.string().optional(),
  transactionDate: z.string().nullable(),
  categoryId: z.string().optional(),
  category: z.unknown().optional(),
  recordedById: z.string().optional(),
  recordedBy: z.unknown().optional(),
  version: z.number().int().optional(),
});

export type CreateFinanceTransactionInput = z.infer<typeof CreateFinanceTransactionSchema>;
export type UpdateFinanceTransactionInput = z.infer<typeof UpdateFinanceTransactionSchema>;
