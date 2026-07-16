import { z } from "zod";

export const CreateRecruitmentSubmissionSchema = z.object({
  recruitmentId: z.string(),
  recruitment: z.unknown(),
  name: z.string(),
  nim: z.string(),
  divisionInterestId: z.string(),
  divisionInterest: z.unknown(),
  contact: z.string(),
  customAnswers: z.unknown(),
  status: z.string(),
  version: z.number().int(),
});

export const UpdateRecruitmentSubmissionSchema = z.object({
  recruitmentId: z.string().optional(),
  recruitment: z.unknown().optional(),
  name: z.string().optional(),
  nim: z.string().optional(),
  divisionInterestId: z.string().optional(),
  divisionInterest: z.unknown().optional(),
  contact: z.string().optional(),
  customAnswers: z.unknown().optional(),
  status: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateRecruitmentSubmissionInput = z.infer<typeof CreateRecruitmentSubmissionSchema>;
export type UpdateRecruitmentSubmissionInput = z.infer<typeof UpdateRecruitmentSubmissionSchema>;
