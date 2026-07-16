import { z } from "zod";

export const CreateRecruitmentTargetDivisionSchema = z.object({
  recruitmentId: z.string(),
  recruitment: z.unknown(),
  divisionId: z.string(),
  division: z.unknown(),
  version: z.number().int(),
});

export const UpdateRecruitmentTargetDivisionSchema = z.object({
  recruitmentId: z.string().optional(),
  recruitment: z.unknown().optional(),
  divisionId: z.string().optional(),
  division: z.unknown().optional(),
  version: z.number().int().optional(),
});

export type CreateRecruitmentTargetDivisionInput = z.infer<typeof CreateRecruitmentTargetDivisionSchema>;
export type UpdateRecruitmentTargetDivisionInput = z.infer<typeof UpdateRecruitmentTargetDivisionSchema>;
