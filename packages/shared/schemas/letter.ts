import { z } from "zod";

/** Admin/API create payload (snake_case JSON). */
export const CreateLetterSchema = z.object({
  type: z.string(),
  category_id: z.string().optional(),
  template_id: z.string().optional(),
  subject: z.string().optional(),
  letter_date: z.string().nullable().optional(),
  sender: z.string().optional(),
  recipient: z.string().optional(),
  document_url: z.string().optional(),
  document_key: z.string().optional(),
  file_name: z.string().optional(),
  letter_code: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});

export const UpdateLetterSchema = CreateLetterSchema.partial();

export type CreateLetterInput = z.infer<typeof CreateLetterSchema>;
export type UpdateLetterInput = z.infer<typeof UpdateLetterSchema>;
